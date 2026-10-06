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
 * Même famille que `jpegSansMetadonnees` (texte_incruste.ts).
 *
 * Une signature peut aussi vivre DANS le flux vidéo : un SEI « données
 * utilisateur non enregistrées » (H.264 type 5), un UUID suivi d'un texte libre.
 * Kling en écrit un, « kling-ai », en tête des échantillons (vu le 06/10 sur les
 * premiers rendus) ; x264 y range ses réglages. Un NAL SEI qui ne porte QUE ce
 * type de message est retiré de son échantillon : `stsz` reprend la nouvelle
 * taille et `stco` / `co64` sont recalés des octets retirés avant eux. Les
 * images ne sont pas touchées, aucun ré-encodage. Un SEI qui mêle ce message
 * à d'autres (horloge, point de reprise) est laissé — `metadonneesMp4` le
 * signale, et l'appelant refuse le fichier plutôt que de le livrer.
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
function feuille(o: Uint8Array, b: Boite, sei: RetraitSei): Noeud {
  const copie = o.slice(b.debut, b.fin);
  const c = b.entete; // début du contenu dans `copie`
  const tailles = b.type === "stsz" ? sei.stsz.get(b.debut) : undefined;
  if (tailles) {
    // version/flags (4) + sample_size (4, nul ici) + sample_count (4), puis les tailles.
    for (let k = 0; k < tailles.length; k += 1) ecrireU32(copie, c + 12 + 4 * k, tailles[k]!);
    return { brut: copie };
  }
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

function reconstruire(o: Uint8Array, b: Boite, sei: RetraitSei): Noeud {
  const enfants: Noeud[] = [];
  for (const e of lireBoites(o, b.debut + b.entete, b.fin)) {
    if (RETIREES.has(e.type)) continue;
    if (e.type === "moof" || (b.type === "moov" && e.type === "mvex")) {
      throw new Error("mp4 : fichier fragmenté, non géré");
    }
    enfants.push(CONTENEURS.has(e.type) ? reconstruire(o, e, sei) : feuille(o, e, sei));
  }
  return { type: b.type, enfants };
}

/* ─── SEI de données utilisateur, dans le flux vidéo ─────────────────────── */

/** Un échantillon vidéo : sa place dans le fichier lu. */
interface Echantillon {
  debut: number;
  taille: number;
}

interface PisteVideo {
  /** Début (dans le fichier lu) de la boîte `stsz` de la piste. */
  stsz: number;
  echantillons: Echantillon[];
  /** Taille du préfixe de longueur des NAL (avcC / hvcC), 1 à 4 octets. */
  longueurNal: number;
  hevc: boolean;
}

/** Ce que le retrait des SEI change : plages retirées, nouvelles tailles. */
interface RetraitSei {
  /** Plages `[debut, fin)` du fichier lu, triées, à ne pas recopier. */
  plages: Array<[number, number]>;
  /** Nouvelles tailles d'échantillon, par début de boîte `stsz`. */
  stsz: Map<number, number[]>;
}

const SANS_RETRAIT: RetraitSei = { plages: [], stsz: new Map() };

function enfant(o: Uint8Array, b: Boite, type: string): Boite | undefined {
  return lireBoites(o, b.debut + b.entete, b.fin).find((e) => e.type === type);
}

/**
 * Les pistes vidéo H.264 / H.265 d'un moov, avec leurs échantillons. Une piste
 * qu'on ne sait pas lire (taille d'échantillon constante, `stz2`, codec sans
 * avcC / hvcC) est ignorée : on n'en retire rien.
 */
function pistesVideo(o: Uint8Array, moov: Boite): PisteVideo[] {
  const pistes: PisteVideo[] = [];
  for (const trak of lireBoites(o, moov.debut + moov.entete, moov.fin)) {
    if (trak.type !== "trak") continue;
    const mdia = enfant(o, trak, "mdia");
    const hdlr = mdia && enfant(o, mdia, "hdlr");
    if (!mdia || !hdlr || typeDe(o, hdlr.debut + hdlr.entete + 8) !== "vide") continue;
    const minf = enfant(o, mdia, "minf");
    const stbl = minf && enfant(o, minf, "stbl");
    if (!stbl) continue;
    const stsd = enfant(o, stbl, "stsd");
    const stsz = enfant(o, stbl, "stsz");
    const stsc = enfant(o, stbl, "stsc");
    const stco = enfant(o, stbl, "stco") ?? enfant(o, stbl, "co64");
    if (!stsd || !stsz || !stsc || !stco) continue;

    const entrees = lireBoites(o, stsd.debut + stsd.entete + 8, stsd.fin);
    if (entrees.length !== 1) continue;
    const entree = entrees[0]!;
    const hevc = entree.type === "hvc1" || entree.type === "hev1";
    if (!hevc && entree.type !== "avc1" && entree.type !== "avc3") continue;
    // En-tête d'une entrée visuelle : 78 octets, puis ses boîtes (avcC, pasp…).
    const config = lireBoites(o, entree.debut + entree.entete + 78, entree.fin)
      .find((e) => e.type === (hevc ? "hvcC" : "avcC"));
    if (!config) continue;
    const octetLongueur = config.debut + config.entete + (hevc ? 21 : 4);
    if (octetLongueur >= config.fin) continue;
    const longueurNal = (o[octetLongueur]! & 0x03) + 1;
    if (longueurNal === 3) continue;

    const cz = stsz.debut + stsz.entete;
    if (lireU32(o, cz + 4) !== 0) continue; // taille constante : rien à réécrire
    const nEch = lireU32(o, cz + 8);
    if (cz + 12 + 4 * nEch > stsz.fin) throw new Error("mp4 : stsz tronqué");
    const tailles = Array.from({ length: nEch }, (_, k) => lireU32(o, cz + 12 + 4 * k));

    const cc = stco.debut + stco.entete;
    const largeur = stco.type === "stco" ? 4 : 8;
    const nMorceaux = lireU32(o, cc + 4);
    if (cc + 8 + largeur * nMorceaux > stco.fin) throw new Error(`mp4 : ${stco.type} tronqué`);
    const morceaux = Array.from({ length: nMorceaux }, (_, k) =>
      largeur === 4 ? lireU32(o, cc + 8 + 4 * k) : lireU64(o, cc + 8 + 8 * k));

    const cs = stsc.debut + stsc.entete;
    const nRegles = lireU32(o, cs + 4);
    if (cs + 8 + 12 * nRegles > stsc.fin) throw new Error("mp4 : stsc tronqué");
    const regles = Array.from({ length: nRegles }, (_, k) => ({
      premier: lireU32(o, cs + 8 + 12 * k),
      parMorceau: lireU32(o, cs + 12 + 12 * k),
    }));

    const echantillons: Echantillon[] = [];
    let s = 0;
    for (let m = 0; m < nMorceaux && s < nEch; m += 1) {
      // La dernière règle dont le premier morceau (1-indexé) est atteint.
      let parMorceau = 0;
      for (const r of regles) if (r.premier <= m + 1) parMorceau = r.parMorceau;
      let pos = morceaux[m]!;
      for (let k = 0; k < parMorceau && s < nEch; k += 1, s += 1) {
        echantillons.push({ debut: pos, taille: tailles[s]! });
        pos += tailles[s]!;
      }
    }
    if (s !== nEch) throw new Error(`mp4 : ${nEch - s} échantillon(s) hors de stsc`);
    pistes.push({ stsz: stsz.debut, echantillons, longueurNal, hevc });
  }
  return pistes;
}

/** Le RBSP d'un NAL : sans les octets d'échappement `00 00 03`. */
function rbsp(nal: Uint8Array): Uint8Array {
  const sortie: number[] = [];
  let zeros = 0;
  for (const b of nal) {
    if (zeros >= 2 && b === 0x03) {
      zeros = 0;
      continue;
    }
    sortie.push(b);
    zeros = b === 0 ? zeros + 1 : 0;
  }
  return Uint8Array.from(sortie);
}

/**
 * Les messages d'un NAL SEI (sans son en-tête) : type et contenu. `null` si le
 * NAL est illisible — on ne retire alors rien.
 */
function messagesSei(corps: Uint8Array): Array<{ type: number; contenu: Uint8Array }> | null {
  const r = rbsp(corps);
  const messages: Array<{ type: number; contenu: Uint8Array }> = [];
  let i = 0;
  // S'arrête sur les bits de fin du RBSP (0x80, éventuellement suivis de zéros).
  while (i < r.length && !(r[i] === 0x80 && r.subarray(i + 1).every((b) => b === 0))) {
    let type = 0;
    while (r[i] === 0xff) { type += 255; i += 1; }
    if (i >= r.length) return null;
    type += r[i]!; i += 1;
    let taille = 0;
    while (r[i] === 0xff) { taille += 255; i += 1; }
    if (i >= r.length) return null;
    taille += r[i]!; i += 1;
    if (i + taille > r.length) return null;
    messages.push({ type, contenu: r.subarray(i, i + taille) });
    i += taille;
  }
  return messages.length ? messages : null;
}

const SEI_DONNEES_UTILISATEUR = 5;

/** Texte lisible d'un message « données utilisateur » (après l'UUID de 16 octets). */
function texteDonneesUtilisateur(contenu: Uint8Array): string {
  return String.fromCharCode(...contenu.subarray(16))
    .replace(/[^\x20-\x7e]+/g, " ")
    .trim()
    .slice(0, 40);
}

/**
 * Les NAL SEI de données utilisateur des pistes vidéo : où ils sont, et s'ils
 * ne portent QUE ce type de message (donc retirables sans rien perdre d'autre).
 */
function seiDonneesUtilisateur(o: Uint8Array, pistes: PisteVideo[]) {
  const trouves: Array<{ piste: number; echantillon: number; debut: number; fin: number; seul: boolean; texte: string }> = [];
  pistes.forEach((p, ip) => {
    p.echantillons.forEach((e, ie) => {
      let i = e.debut;
      const fin = e.debut + e.taille;
      if (fin > o.length) throw new Error("mp4 : échantillon hors du fichier");
      while (i + p.longueurNal <= fin) {
        let n = 0;
        for (let k = 0; k < p.longueurNal; k += 1) n = n * 256 + o[i + k]!;
        const nal = i + p.longueurNal;
        if (n === 0 || nal + n > fin) break; // échantillon illisible : on s'arrête là
        const entete = p.hevc ? 2 : 1;
        const type = p.hevc ? (o[nal]! >> 1) & 0x3f : o[nal]! & 0x1f;
        const estSei = p.hevc ? type === 39 || type === 40 : type === 6;
        if (estSei && n > entete) {
          const messages = messagesSei(o.subarray(nal + entete, nal + n));
          const utilisateur = messages?.filter((m) => m.type === SEI_DONNEES_UTILISATEUR) ?? [];
          if (utilisateur.length) {
            trouves.push({
              piste: ip,
              echantillon: ie,
              debut: i,
              fin: nal + n,
              seul: utilisateur.length === messages!.length,
              texte: utilisateur.map((m) => texteDonneesUtilisateur(m.contenu)).join(" | "),
            });
          }
        }
        i = nal + n;
      }
    });
  });
  return trouves;
}

function planRetraitSei(o: Uint8Array, moov: Boite): RetraitSei {
  const pistes = pistesVideo(o, moov);
  const seuls = seiDonneesUtilisateur(o, pistes).filter((t) => t.seul);
  if (!seuls.length) return SANS_RETRAIT;
  const stsz = new Map<number, number[]>();
  for (const t of seuls) {
    const p = pistes[t.piste]!;
    const tailles = stsz.get(p.stsz) ?? p.echantillons.map((e) => e.taille);
    tailles[t.echantillon]! -= t.fin - t.debut;
    stsz.set(p.stsz, tailles);
  }
  const plages = seuls.map((t) => [t.debut, t.fin] as [number, number]).sort((a, b) => a[0] - b[0]);
  return { plages, stsz };
}

/** Octets retirés dans `[debut, pos)`. */
function retiresAvant(plages: Array<[number, number]>, debut: number, pos: number): number {
  let n = 0;
  for (const [a, b] of plages) {
    if (b <= debut || a >= pos) continue;
    n += Math.min(b, pos) - Math.max(a, debut);
  }
  return n;
}

/** Un mdat sans les plages retirées, en-tête recalculé (même largeur). */
function mdatSansPlages(o: Uint8Array, b: Boite, plages: Array<[number, number]>): Uint8Array {
  const dedans = plages.filter(([a, z]) => a >= b.debut + b.entete && z <= b.fin);
  if (!dedans.length) return o.subarray(b.debut, b.fin);
  const retire = dedans.reduce((s, [a, z]) => s + (z - a), 0);
  const sortie = new Uint8Array(b.fin - b.debut - retire);
  let p = b.entete;
  let i = b.debut + b.entete;
  for (const [a, z] of dedans) {
    sortie.set(o.subarray(i, a), p);
    p += a - i;
    i = z;
  }
  sortie.set(o.subarray(i, b.fin), p);
  // En-tête : même largeur qu'à l'origine, pour ne pas déplacer les données.
  for (let k = 0; k < 4; k += 1) sortie[4 + k] = "mdat".charCodeAt(k);
  if (b.entete === 16) {
    ecrireU32(sortie, 0, 1);
    ecrireU64(sortie, 8, sortie.length);
  } else {
    ecrireU32(sortie, 0, sortie.length);
  }
  return sortie;
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

  const sei = planRetraitSei(octets, moovs[0]!);

  // Plan de sortie : l'ordre d'origine, moins les boîtes retirées.
  const plan: Array<{ boite: Boite; noeud: Noeud }> = [];
  for (const b of haut) {
    if (RETIREES.has(b.type)) continue;
    const noeud = b.type === "moov"
      ? reconstruire(octets, b, sei)
      : { brut: b.type === "mdat" ? mdatSansPlages(octets, b, sei.plages) : octets.subarray(b.debut, b.fin) };
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
      const nouveau = m.nouveau + (ancien - m.ancien) - retiresAvant(sei.plages, m.ancien, ancien);
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
 * `meta` / `uuid`, dates non nulles, SEI de données utilisateur dans le flux
 * vidéo (`mdat:sei(kling-ai)`). Vide = propre. Sert de contrôle après
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
  const moov = lireBoites(octets, 0, octets.length).find((b) => b.type === "moov");
  if (moov) {
    const vus = new Set<string>();
    for (const t of seiDonneesUtilisateur(octets, pistesVideo(octets, moov))) {
      const cle = `mdat:sei(${t.texte || "?"})`;
      if (!vus.has(cle)) restes.push(cle);
      vus.add(cle);
    }
  }
  return restes;
}
