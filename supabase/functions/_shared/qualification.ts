/**
 * Qualification d'un compte créateur — cinq cases, plus de score.
 *
 * L'ELO compte donnait un nombre. « 41,3 » ne dit pas s'il faut relancer le
 * créateur, changer son quota ou ne pas renouveler son contrat. Les cases le
 * disent, et elles se lisent à voix haute en réunion.
 *
 * Ce module est PUR : aucune base, aucun réseau. Il est rejoué tel quel par
 * les tests du front (`src/features/moteur/qualification.ts`), comme
 * `tierlist.ts`.
 */

/** De la pire à la meilleure. L'ordre du tableau EST le classement. */
export const QUALIFICATIONS = [
  "INACTIF",
  "MAUVAISES_VUES",
  "PASSABLE",
  "BIEN",
  "STAR",
] as const;

export type Qualification = (typeof QUALIFICATIONS)[number];

/** Fenêtre de jugement : les 10 derniers posts prévus, les 10 derniers publiés. */
export const FENETRE_POSTS = 10;

/** Sous cette moyenne de vues, le compte ne ramène rien. */
export const VUES_MAUVAISES = 600;
/** À partir de cette moyenne, le compte travaille. */
export const VUES_BIEN = 1_000;
/** Au-dessus, le compte porte la langue. */
export const VUES_STAR = 10_000;

/** Part des posts prévus qu'il faut avoir publiés. */
export const PART_INACTIF = 0.6; // 6 sur 10 ou moins
export const PART_BIEN = 0.8; // au moins 8 sur 10
export const PART_STAR = 0.9; // au moins 9 sur 10

export function indexQualification(q: Qualification): number {
  return QUALIFICATIONS.indexOf(q);
}

export function estQualification(v: unknown): v is Qualification {
  return typeof v === "string" && (QUALIFICATIONS as readonly string[]).includes(v);
}

/** La moins bonne de deux cases. */
export function pireQualification(a: Qualification, b: Qualification): Qualification {
  return indexQualification(a) <= indexQualification(b) ? a : b;
}

/**
 * Seuils ramenés au nombre de posts RÉELLEMENT prévus.
 *
 * « Si moins de 10 prévus, prendre le nombre maximal de prévus » : un compte
 * qui n'a eu que 4 créneaux ne peut pas en publier 8. C'est donc la proportion
 * qui fait foi — 6/10, 8/10, 9/10 — appliquée au nombre de créneaux qu'il a
 * vraiment eus. Sur 10 prévus, on retombe exactement sur l'énoncé.
 */
export function seuilInactif(prevus: number): number {
  return Math.floor(PART_INACTIF * prevus);
}

export function seuilBien(prevus: number): number {
  return Math.ceil(PART_BIEN * prevus);
}

export function seuilStar(prevus: number): number {
  return Math.ceil(PART_STAR * prevus);
}

export interface DonneesQualification {
  /** Posts prévus sur la fenêtre, créneau du jour exclu (il est encore ouvert). */
  prevus: number;
  /** Parmi ces prévus, ceux réellement publiés par le créateur. */
  publies: number;
  /**
   * Moyenne de vues des ≤10 derniers posts publiés ET mesurés.
   * `null` = rien de mesuré : on ne juge pas les vues d'un compte muet.
   */
  moyenneVues: number | null;
}

/**
 * La case d'un compte.
 *
 * Deux familles de règles, et c'est volontaire :
 *
 * - **ce qui fait monter** — les vues et l'assiduité, qui donnent BIEN ou STAR,
 *   sinon PASSABLE. Ces bandes sont emboîtées (tout STAR est aussi un BIEN),
 *   donc on garde la plus haute qui tient : appliquer « la moins bonne » ici
 *   dégraderait mécaniquement chaque STAR en BIEN.
 * - **ce qui fait descendre** — l'inactivité et les vues basses. Elles ne
 *   peuvent que tirer vers le bas, et c'est là que joue la règle « si le
 *   créateur rentre dans plusieurs catégories, il va dans la moins bonne » :
 *   un compte qui fait 50 000 vues de moyenne mais n'a publié que 5 posts sur
 *   10 est INACTIF, pas STAR.
 */
export function qualifierCompte(d: DonneesQualification): Qualification {
  const prevus = Math.max(0, Math.floor(d.prevus));
  const publies = Math.max(0, Math.floor(d.publies));
  const m = d.moyenneVues;

  // Ce qui fait monter.
  let q: Qualification = "PASSABLE";
  if (prevus > 0 && m != null) {
    if (m > VUES_STAR && publies >= seuilStar(prevus)) q = "STAR";
    else if (m >= VUES_BIEN && publies >= seuilBien(prevus)) q = "BIEN";
  }

  // Ce qui fait descendre.
  if (m != null && m < VUES_MAUVAISES) q = pireQualification(q, "MAUVAISES_VUES");
  if (prevus > 0 && publies <= seuilInactif(prevus)) q = pireQualification(q, "INACTIF");

  return q;
}

/** Un passage, vu par la qualification. Le minimum pour juger, rien de plus. */
export interface PassageJuge {
  date_publication_prevue: string | null;
  publie_at: string | null;
  publie_url: string | null;
  statut: string | null;
  vues: number | null;
  /** Post de test : ce n'est pas un post du créateur, il ne compte nulle part. */
  est_test?: boolean;
}

/** Le créateur a-t-il vraiment publié ce passage ? */
export function passagePublie(p: PassageJuge): boolean {
  return p.statut === "publie" || Boolean(p.publie_at) || Boolean(p.publie_url);
}

/**
 * Découpe les deux fenêtres depuis les passages bruts d'un compte.
 *
 * Cette fonction vit ici, avec les règles, et pas à côté de la requête : le
 * moteur et l'écran de surveillance doivent compter pareil, sinon l'admin lit
 * « 7 sur 10 » en face d'une case posée sur un autre calcul.
 *
 * - assiduité : les 10 derniers créneaux ÉCHUS (`aujourdhui` exclu — le
 *   créneau du jour est encore ouvert) ;
 * - vues : les 10 derniers posts publiés, moyenne sur ceux qui sont mesurés.
 *
 * Les lignes peuvent arriver dans n'importe quel ordre : le tri est fait ici.
 */
export function donneesDepuisPassages(
  rows: PassageJuge[],
  aujourdhui: string,
): DonneesQualification {
  const utiles = rows.filter((p) => !p.est_test);

  const echus = utiles
    .filter((p) => p.date_publication_prevue != null && p.date_publication_prevue < aujourdhui)
    .sort((a, b) => (a.date_publication_prevue! < b.date_publication_prevue! ? 1 : -1))
    .slice(0, FENETRE_POSTS);

  const quand = (p: PassageJuge) => p.publie_at ?? p.date_publication_prevue ?? "";
  const publies = utiles
    .filter(passagePublie)
    .sort((a, b) => (quand(a) < quand(b) ? 1 : quand(a) > quand(b) ? -1 : 0))
    .slice(0, FENETRE_POSTS);

  const mesurees = publies
    .map((p) => p.vues)
    .filter((v): v is number => v != null);

  return {
    prevus: echus.length,
    publies: echus.filter(passagePublie).length,
    moyenneVues: mesurees.length
      ? mesurees.reduce((s, v) => s + v, 0) / mesurees.length
      : null,
  };
}

// ---------------------------------------------------------------------------
// Essai (TRIAL) et file de surveillance
// ---------------------------------------------------------------------------

/** Durée de l'essai d'un compte, à partir de sa création dans l'OS. */
export const TRIAL_HEURES = 80;
/** Combien de temps avant la fin de l'essai le compte entre dans la file. */
export const TRIAL_ALERTE_HEURES = 30;
/** Durée d'un « skip » depuis la file de surveillance. */
export const SKIP_JOURS = 7;

const MS_HEURE = 3_600_000;

/** Fin de l'essai d'un compte créé le `creeLe`. */
export function finTrial(creeLe: string | Date): Date {
  const t = creeLe instanceof Date ? creeLe : new Date(creeLe);
  return new Date(t.getTime() + TRIAL_HEURES * MS_HEURE);
}

/** Le compte est-il encore dans ses 80 premières heures ? */
export function estEnTrial(creeLe: string | Date, maintenant: Date = new Date()): boolean {
  return maintenant.getTime() < finTrial(creeLe).getTime();
}

/**
 * Un compte en essai entre OBLIGATOIREMENT dans la file 30 h avant la fin —
 * c'est le dernier moment où décider de le garder ou non veut encore dire
 * quelque chose.
 */
export function trialAAlerter(creeLe: string | Date, maintenant: Date = new Date()): boolean {
  const fin = finTrial(creeLe).getTime();
  const now = maintenant.getTime();
  return now < fin && fin - now <= TRIAL_ALERTE_HEURES * MS_HEURE;
}

export interface EtatSurveillance {
  qualification: Qualification;
  /** `comptes.created_at`. */
  creeLe: string;
  /** `comptes.surveillance_skip_jusqu_a`, si le compte a été écarté. */
  skipJusqua?: string | null;
}

/**
 * Le compte doit-il apparaître dans la file de surveillance ?
 *
 * Un compte en fin d'essai y entre même s'il a été skippé : le skip repousse
 * une relance, il ne fait pas disparaître une échéance de contrat.
 */
export function enSurveillance(e: EtatSurveillance, maintenant: Date = new Date()): boolean {
  if (trialAAlerter(e.creeLe, maintenant)) return true;
  const skippe = e.skipJusqua != null && new Date(e.skipJusqua).getTime() > maintenant.getTime();
  if (skippe) return false;
  return e.qualification === "INACTIF" || e.qualification === "MAUVAISES_VUES";
}

/** Date de fin d'un « skip » posé maintenant. */
export function finSkip(maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() + SKIP_JOURS * 24 * MS_HEURE);
}
