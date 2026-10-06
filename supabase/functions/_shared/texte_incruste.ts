/**
 * Slideshows à TEXTE INCRUSTÉ (white posts, 0306).
 *
 * Un slideshow ordinaire est deux listes tenues ensemble : des images propres
 * (`contenus.structure_slides`) et, par langue, des textes posés par-dessus
 * (`contenu_langues.slides`). Le moteur traduit à la demande, place le CTA
 * micabo, et le créateur recopie le texte sur l'image.
 *
 * Ici le texte est DANS l'image : traduire n'a pas de sens, et une même image
 * ne peut pas servir deux langues. Chaque deck de langue porte donc ses propres
 * images, slide par slide (`media_id`), et un texte vide. Conséquences, toutes
 * tenues par le moteur :
 *
 * - une langue sans deck complet n'est JAMAIS servie — pas de traduction à la
 *   demande, pas de repli sur une autre langue ;
 * - pas de placement micabo, pas de passe concurrents sur le texte : le CTA a
 *   été dessiné dans l'image, une fois pour toutes ;
 * - le visuel d'un post vient du deck de SA langue, jamais de la structure ni
 *   de la bibliothèque du label.
 *
 * Module pur : réexporté par `src/features/moteur/texteIncruste.ts` et testé
 * côté front, pour que l'éditeur de la file et l'assignation comptent pareil.
 */

export interface SlideIncrustee {
  position: number;
  media_id?: string | null;
  texte_overlay?: string | null;
  position_sophia?: boolean;
}

export interface DeckIncruste {
  langue: string;
  slides: SlideIncrustee[] | null | undefined;
}

/**
 * Un deck incrusté est servable quand CHAQUE slide porte son image et que les
 * positions vont de 1 à n sans trou ni doublon.
 *
 * Exiger 1..n et pas seulement « un média par entrée » : un deck dont une slide
 * a été retirée sans renumérotation partirait avec un trou que personne ne
 * verrait avant le créateur — exactement le défaut de 0279.
 */
export function deckIncrustePret(slides: SlideIncrustee[] | null | undefined): boolean {
  if (!Array.isArray(slides) || slides.length === 0) return false;
  const positions = slides.map((s) => Number(s.position)).sort((a, b) => a - b);
  if (positions.some((p, i) => p !== i + 1)) return false;
  return slides.every((s) => typeof s.media_id === "string" && s.media_id.length > 0);
}

/** Langues réellement servables d'un slideshow incrusté, triées. */
export function languesIncrustees(decks: DeckIncruste[]): string[] {
  return decks
    .filter((d) => deckIncrustePret(d.slides))
    .map((d) => d.langue)
    .sort();
}

/**
 * Le deck tel qu'il part chez le créateur : texte vide (il est dans l'image),
 * aucune marque de placement, l'image de la langue à chaque position.
 */
export function deckIncrusteServi(slides: SlideIncrustee[]): Array<{
  position: number;
  media_id: string;
  texte_overlay: string;
  position_sophia: boolean;
}> {
  return slides
    .slice()
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((s) => ({
      position: Number(s.position),
      media_id: String(s.media_id ?? ""),
      texte_overlay: "",
      position_sophia: false,
    }));
}

/**
 * Visuels à poser sur `post_slides` : l'image du deck, position par position.
 *
 * Lève si une position n'a pas d'image : un post incrusté sans visuel est une
 * slide blanche, et l'appelant doit repiocher plutôt que livrer (0279).
 */
export function visuelsIncrustes(
  slides: Array<{ position: number; media_id?: string | null }>,
): Array<{ position: number; media_id: string; reference_url: null }> {
  return slides.map((s) => {
    if (!s.media_id) {
      throw new Error(`Texte incrusté : la slide #${s.position} n'a pas d'image pour cette langue`);
    }
    return { position: Number(s.position), media_id: s.media_id, reference_url: null };
  });
}

/**
 * Retire toutes les métadonnées d'un JPEG : segments APP0 à APP15 et COM —
 * EXIF, XMP, IPTC, ICC, JFIF, Content Credentials (C2PA / JUMBF).
 *
 * Seul APP14 (« Adobe ») est gardé : ce n'est pas une métadonnée mais un
 * paramètre de décodage (transformation de couleur), et le retirer peut
 * fausser les couleurs d'un JPEG CMJN. Les tables (DQT, DHT), l'en-tête de
 * trame (SOF) et les données image (à partir de SOS) passent octet pour octet :
 * aucun ré-encodage, donc aucune perte.
 *
 * Plus large que `retirerContentCredentials` (c2pa.ts), qui ne vise que C2PA :
 * une image dont le texte est déjà dessiné n'a rien à garder de ses en-têtes.
 */
export function jpegSansMetadonnees(octets: Uint8Array): Uint8Array {
  if (octets.length < 4 || octets[0] !== 0xff || octets[1] !== 0xd8) {
    throw new Error("jpegSansMetadonnees : ce n'est pas un JPEG");
  }
  const morceaux: Uint8Array[] = [octets.subarray(0, 2)];
  let i = 2;
  while (i < octets.length) {
    if (octets[i] !== 0xff) throw new Error(`jpegSansMetadonnees : marqueur attendu à l'octet ${i}`);
    // Octets de bourrage 0xFF autorisés avant un marqueur.
    while (i < octets.length && octets[i] === 0xff) i += 1;
    const m = octets[i]!;
    i += 1;
    if (m === 0xda) {
      // Début de scan : tout le reste est l'image.
      morceaux.push(Uint8Array.of(0xff, m), octets.subarray(i));
      break;
    }
    if (m === 0xd9) {
      morceaux.push(Uint8Array.of(0xff, m));
      break;
    }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      // Marqueurs sans longueur.
      morceaux.push(Uint8Array.of(0xff, m));
      continue;
    }
    if (i + 1 >= octets.length) throw new Error("jpegSansMetadonnees : segment tronqué");
    const n = (octets[i]! << 8) | octets[i + 1]!;
    if (n < 2 || i + n > octets.length) throw new Error("jpegSansMetadonnees : longueur de segment invalide");
    const metadonnee = (m >= 0xe0 && m <= 0xef && m !== 0xee) || m === 0xfe;
    if (!metadonnee) morceaux.push(Uint8Array.of(0xff, m), octets.subarray(i, i + n));
    i += n;
  }
  let total = 0;
  for (const p of morceaux) total += p.length;
  const sortie = new Uint8Array(total);
  let o = 0;
  for (const p of morceaux) {
    sortie.set(p, o);
    o += p.length;
  }
  return sortie;
}

/** Chemin storage d'une image incrustée : un dossier par slideshow et par langue. */
export function cheminIncruste(contenuId: string, langue: string, position: number): string {
  return `incruste/${contenuId}/${langue}/${position}.jpg`;
}
