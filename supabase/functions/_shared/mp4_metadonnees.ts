/**
 * MP4 sans métadonnées (AI UGC, 06/10/2026) — module PUR, sans réseau.
 *
 * Le créateur télécharge la vidéo réaction (Kling) et la démo micabo telles
 * quelles : aucune ne doit dire d'où elle sort. Un MP4 porte ses métadonnées
 * dans des boîtes à part, jamais dans l'image :
 *
 *   - `udta` et `meta` (moov, trak) : encodeur (`©too` « Lavf… »), date, lieu
 *     (`©xyz`), modèle de téléphone (`com.apple.quicktime.model`), titre ;
 *   - `uuid` : XMP et Content Credentials (C2PA), au niveau haut ou dans moov ;
 *   - les dates de `mvhd`, `tkhd`, `mdhd` (création, modification) ;
 *   - le nom libre de `hdlr` (« Core Media Video », « VideoHandler ») et le
 *     `compressorname` de l'entrée vidéo de `stsd` (« Lavc… », « AVC Coding »).
 *
 * Rien n'est ré-encodé : `mdat` (les images et le son) passe octet pour octet.
 * Retirer des boîtes déplace `mdat`, donc les offsets de `stco` / `co64`
 * (positions ABSOLUES des morceaux dans le fichier) sont recalés, mdat par mdat.
 *
 * Même famille que `jpegSansMetadonnees` (texte_incruste.ts). Ce que ce module
 * ne touche pas : un SEI d'encodeur écrit DANS le flux vidéo (x264 en laisse un
 * dans la première image). Il faudrait réécrire les NAL, donc toucher à mdat.
 *
 * Un MP4 fragmenté (`moof`) est refusé plutôt que mal recalé : ses offsets
 * peuvent être relatifs au fragment ou absolus selon les drapeaux, et ni Kling
 * ni un enregistrement d'écran d'iPhone n'en produisent.
 */

/** Boîtes retirées partout où on les rencontre (haut niveau et arbre moov). */
const RETIREES = new Set(["udta", "meta", "uuid", "free", "skip", "wide"]);

/** Conteneurs purs : leur contenu est une suite de boîtes. */
const CONTENEURS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "mvex"]);

/** Entrées vidéo de `stsd` dont l'en-tête porte un `compressorname`. */
const ENTREES_VIDEO = new Set(["avc1", "avc3", "hvc1", "hev1", "mp4v", "vp09", "av01", "encv"]);

interface Boite {
  type: string;
  /** Début de la boîte (en-tête compris) dans le tableau lu. */
  debut: number;
  /** Fin exclusive. */
  fin: number;
  /** Taille de l'en-tête (8, ou 16 avec largesize). */
  entete: number;
}

function typeDe(o: Uint8Array, i: number): string {
  return String.fromCharCode(o[i]!, o[i + 1]!, o[i + 2]!, o[i + 3]!);
}

function lireU32(o: Uint8Array, i: number): number {
  return ((o[i]! << 24) >>> 0) + (o[i + 1]! << 16) + (o[i + 2]! << 8) + o[i + 3]!;
}

function ecrireU32(o: Uint8Array, i: number, v: number): void {
  o[i] = (v >>> 24) & 0xff;
  o[i + 1] = (v >>> 16) & 0xff;
  o[i + 2] = (v >>> 8) & 0xff;
  o[i + 3] = v & 0xff;
}

function lireU64(o: Uint8Array, i: number): number {
  const haut = lireU32(o, i);
  const bas = lireU32(o, i + 4);
  return haut * 0x1_0000_0000 + bas;
}

function ecrireU64(o: Uint8Array, i: number, v: number): void {
  ecrireU32(o, i, Math.floor(v / 0x1_0000_0000));
  ecrireU32(o, i + 4, v >>> 0);
}

/** Boîtes successives de `o[debut, fin)`. Lève sur une taille incohérente. */
function lireBoites(o: Uint8Array, debut: number, fin: number): Boite[] {
  const boites: Boite[] = [];
  let i = debut;
  while (i < fin) {
    if (fin - i < 8) {
      // Quelques octets de bourrage en fin de conteneur : tolérés, ignorés.
      if (o.subarray(i, fin).every((b) => b === 0)) break;
      throw new Error(`mp4 : boîte tronquée à l'octet ${i}`);
    }
    let taille = lireU32(o, i);
    const type = typeDe(o, i + 4);
    let entete = 8;
    if (taille === 1) {
      if (fin - i < 16) throw new Error(`mp4 : largesize tronquée (${type})`);
      taille = lireU64(o, i + 8);
      entete = 16;
    } else if (taille === 0) {
      taille = fin - i; // jusqu'à la fin du parent
    }
    if (taille < entete || i + taille > fin) {
      throw new Error(`mp4 : taille invalide pour ${type} à l'octet ${i}`);
    }
    boites.push({ type, debut: i, fin: i + taille, entete });
    i += taille;
  }
  return boites;
}

/** Nœud de sortie : soit des octets bruts, soit un conteneur reconstruit. */
type Noeud =
  | { brut: Uint8Array; offsets?: { largeur: 4 | 8; debut: number; n: number } }
  | { type: string; enfants: Noeud[] };

function enteteBoite(type: string, taille: number): Uint8Array {
  const h = new Uint8Array(8);
  ecrireU32(h, 0, taille);
  for (let k = 0; k < 4; k += 1) h[4 + k] = type.charCodeAt(k);
  return h;
}

/** Copie d'une boîte feuille, avec les retouches qui ne changent pas sa taille. */
function feuille(o: Uint8Array, b: Boite): Noeud {
  const copie = o.slice(b.debut, b.fin);
  const c = b.entete; // début du contenu dans `copie`
  if (b.type === "mvhd" || b.type === "tkhd" || b.type === "mdhd") {
    // version (1) + flags (3), puis création et modification.
    const version = copie[c];
    if (version === 1) copie.fill(0, c + 4, c + 20);
    else copie.fill(0, c + 4, c + 12);
    return { brut: copie };
  }
  if (b.type === "hdlr") {
    // version/flags (4) + pre_defined (4) + handler_type (4) + reserved (12),
    // puis le nom, chaîne libre terminée par un NUL : on le vide.
    const fixe = c + 24;
    if (copie.length < fixe) return { brut: copie };
    const sortie = new Uint8Array(fixe + 1);
    sortie.set(copie.subarray(0, fixe));
    ecrireU32(sortie, 0, sortie.length);
    if (b.entete === 16) {
      // Jamais vu sur un hdlr, mais on ne réécrit pas un en-tête 64 bits à moitié.
      return { brut: copie };
    }
    return { brut: sortie };
  }
  if (b.type === "stsd") {
    // version/flags (4) + entry_count (4), puis les entrées.
    for (const e of lireBoites(copie, c + 8, copie.length)) {
      if (!ENTREES_VIDEO.has(e.type)) continue;
      // 6 réservés + 2 data_reference_index + 16 + largeur 2 + hauteur 2
      // + résolutions 8 + réservé 4 + frame_count 2 = 42, puis 32 octets.
      const nom = e.debut + e.entete + 42;
      if (nom + 32 <= e.fin) copie.fill(0, nom, nom + 32);
    }
    return { brut: copie };
  }
  if (b.type === "stco" || b.type === "co64") {
    const n = lireU32(copie, c + 4);
    const largeur = b.type === "stco" ? 4 : 8;
    if (c + 8 + n * largeur > copie.length) throw new Error(`mp4 : ${b.type} tronqué`);
    return { brut: copie, offsets: { largeur, debut: c + 8, n } };
  }
  return { brut: copie };
}

function reconstruire(o: Uint8Array, b: Boite): Noeud {
  const enfants: Noeud[] = [];
  for (const e of lireBoites(o, b.debut + b.entete, b.fin)) {
    if (RETIREES.has(e.type)) continue;
    if (e.type === "moof" || (b.type === "moov" && e.type === "mvex")) {
      throw new Error("mp4 : fichier fragmenté, non géré");
    }
    enfants.push(CONTENEURS.has(e.type) ? reconstruire(o, e) : feuille(o, e));
  }
  return { type: b.type, enfants };
}

function tailleNoeud(n: Noeud): number {
  if ("brut" in n) return n.brut.length;
  return 8 + n.enfants.reduce((s, e) => s + tailleNoeud(e), 0);
}

/** Écrit le nœud à `pos` et note où commencent les tables d'offsets. */
function ecrireNoeud(
  n: Noeud,
  sortie: Uint8Array,
  pos: number,
  tables: Array<{ largeur: 4 | 8; debut: number; n: number }>,
): number {
  if ("brut" in n) {
    sortie.set(n.brut, pos);
    if (n.offsets) tables.push({ ...n.offsets, debut: pos + n.offsets.debut });
    return pos + n.brut.length;
  }
  const taille = tailleNoeud(n);
  sortie.set(enteteBoite(n.type, taille), pos);
  let p = pos + 8;
  for (const e of n.enfants) p = ecrireNoeud(e, sortie, p, tables);
  return p;
}

/**
 * Le MP4 sans ses métadonnées. Lève si le fichier n'est pas un MP4 lisible,
 * s'il est fragmenté, ou si un offset de morceau ne tombe dans aucun `mdat`.
 */
export function mp4SansMetadonnees(octets: Uint8Array): Uint8Array {
  const haut = lireBoites(octets, 0, octets.length);
  if (haut.length === 0 || haut[0]!.type !== "ftyp") {
    throw new Error("mp4SansMetadonnees : ce n'est pas un MP4 (ftyp attendu en tête)");
  }
  if (haut.some((b) => b.type === "moof")) throw new Error("mp4 : fichier fragmenté, non géré");
  const moovs = haut.filter((b) => b.type === "moov");
  if (moovs.length !== 1) throw new Error(`mp4SansMetadonnees : ${moovs.length} moov`);

  // Plan de sortie : l'ordre d'origine, moins les boîtes retirées.
  const plan: Array<{ boite: Boite; noeud: Noeud }> = [];
  for (const b of haut) {
    if (RETIREES.has(b.type)) continue;
    const noeud = b.type === "moov" ? reconstruire(octets, b) : { brut: octets.subarray(b.debut, b.fin) };
    plan.push({ boite: b, noeud });
  }

  const total = plan.reduce((s, p) => s + tailleNoeud(p.noeud), 0);
  const sortie = new Uint8Array(total);
  const tables: Array<{ largeur: 4 | 8; debut: number; n: number }> = [];
  const mdats: Array<{ ancien: number; fin: number; nouveau: number }> = [];
  let pos = 0;
  for (const p of plan) {
    if (p.boite.type === "mdat") mdats.push({ ancien: p.boite.debut, fin: p.boite.fin, nouveau: pos });
    pos = ecrireNoeud(p.noeud, sortie, pos, tables);
  }

  // Recalage : chaque offset suit le mdat dans lequel il tombait.
  for (const t of tables) {
    for (let k = 0; k < t.n; k += 1) {
      const i = t.debut + k * t.largeur;
      const ancien = t.largeur === 4 ? lireU32(sortie, i) : lireU64(sortie, i);
      const m = mdats.find((d) => ancien >= d.ancien && ancien < d.fin);
      if (!m) throw new Error(`mp4SansMetadonnees : offset ${ancien} hors de tout mdat`);
      const nouveau = m.nouveau + (ancien - m.ancien);
      if (t.largeur === 4) {
        if (nouveau > 0xffff_ffff) throw new Error("mp4SansMetadonnees : offset hors de stco");
        ecrireU32(sortie, i, nouveau);
      } else {
        ecrireU64(sortie, i, nouveau);
      }
    }
  }
  return sortie;
}

/**
 * Ce qui reste de métadonnées dans un MP4 : chemins des boîtes `udta` /
 * `meta` / `uuid`, dates non nulles. Vide = propre. Sert de contrôle après
 * `mp4SansMetadonnees`, et aux tests.
 */
export function metadonneesMp4(octets: Uint8Array): string[] {
  const restes: string[] = [];
  const parcourir = (debut: number, fin: number, chemin: string) => {
    for (const b of lireBoites(octets, debut, fin)) {
      const ici = chemin ? `${chemin}/${b.type}` : b.type;
      if (b.type === "udta" || b.type === "meta" || b.type === "uuid") {
        restes.push(ici);
        continue;
      }
      if (b.type === "mvhd" || b.type === "tkhd" || b.type === "mdhd") {
        const c = b.debut + b.entete;
        const v1 = octets[c] === 1;
        const dates = octets.subarray(c + 4, c + (v1 ? 20 : 12));
        if (dates.some((x) => x !== 0)) restes.push(`${ici}:dates`);
      }
      if (CONTENEURS.has(b.type)) parcourir(b.debut + b.entete, b.fin, ici);
    }
  };
  parcourir(0, octets.length, "");
  return restes;
}
