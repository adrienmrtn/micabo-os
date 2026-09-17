/**
 * Lecture globale du pool : combien de slideshows le moteur peut réellement
 * tirer, et pour combien de temps.
 *
 * `quota_pool.ts` répond « pourquoi CE créateur est court AUJOURD'HUI ».
 * Celui-ci répond à la question d'au-dessus : où part le stock, et pourquoi
 * les mêmes slideshows reviennent. Les deux constats qui ont motivé ce module :
 *
 *  - une bibliothèque de 166 slideshows dont le moteur n'en voyait que 36,
 *    parce que le tirage exige `statut = 'valide'` — 95 dormaient en file de
 *    validation avec un tier et un cycle ouvert, invisibles ;
 *  - parmi ceux-là, `prioriserTiersHauts` verrouille tous les C tant qu'un seul
 *    B+ doit encore un passage. Le tirage se faisait donc sur 7 slideshows,
 *    et l'on voyait « toujours les 4 ou 5 mêmes ».
 *
 * Aucun de ces deux étages n'était visible nulle part. D'où l'entonnoir.
 *
 * Module PUR : il ne lit rien, on lui passe des comptages. Le moteur et l'écran
 * appliquent ainsi exactement les mêmes règles.
 */

export interface ComptagesPool {
  /** Tous les slideshows de la bibliothèque, quel que soit leur statut. */
  bibliotheque: number;
  /** Écartés à la validation. */
  rejetes: number;
  /** En file de validation : ils ont un tier et un cycle, mais sont intirables. */
  brouillons: number;
  /** `statut = 'valide'` ET `import_statut = 'done'` : le vrai pool. */
  valides: number;
  /** Parmi les valides, ceux qui portent un tier et `passages_cible > 0`. */
  cyclesOuverts: number;
  /** Cycles ouverts à qui il reste au moins un passage dû, en tier B ou mieux. */
  dusBPlus: number;
  /** Idem en tier C — verrouillés tant qu'il reste du B+. */
  dusC: number;
  /** Total des passages encore dus, tous tiers confondus. */
  passagesDus: number;
  /** Somme des `posts_par_jour` des comptes actifs : la consommation. */
  postsParJour: number;
}

export type VerdictPoolGlobal = "critique" | "tendu" | "confortable";

/** En dessous, le pool se vide dans la journée. */
export const AUTONOMIE_CRITIQUE_JOURS = 1;
/** En dessous, il faut alimenter cette semaine. */
export const AUTONOMIE_TENDUE_JOURS = 3;

/**
 * Slideshows que le tirage peut réellement sortir maintenant.
 *
 * `prioriserTiersHauts` ne descend sur les C que si le pool n'a plus rien en B
 * ou mieux. Tant qu'un seul B+ doit un passage, tous les C sont hors jeu — et
 * un C ne peut donc jamais remonter de tier, puisqu'il faut être posté pour
 * être mesuré.
 */
export function tirablesMaintenant(c: ComptagesPool): number {
  return c.dusBPlus > 0 ? c.dusBPlus : c.dusC;
}

/** C mis sur la touche par la priorité aux tiers hauts (0 si le pool est en C seul). */
export function verrouillesParPriorite(c: ComptagesPool): number {
  return c.dusBPlus > 0 ? c.dusC : 0;
}

/**
 * Slideshows validés que le tirage ne voit pas : cycle plein (à x/x, en attente
 * de requalification) ou dormants (tier D, `passages_cible = 0`, repêchables
 * seulement quand plus rien n'est dû).
 */
export function horsJeu(c: ComptagesPool): number {
  return Math.max(0, c.cyclesOuverts - c.dusBPlus - c.dusC);
}

/** Jours de tirage devant nous au rythme actuel. `null` si personne ne poste. */
export function joursAutonomie(c: ComptagesPool): number | null {
  if (c.postsParJour <= 0) return null;
  return c.passagesDus / c.postsParJour;
}

export function verdictPoolGlobal(c: ComptagesPool): VerdictPoolGlobal {
  const jours = joursAutonomie(c);
  if (jours === null) return "confortable";
  if (jours < AUTONOMIE_CRITIQUE_JOURS) return "critique";
  if (jours < AUTONOMIE_TENDUE_JOURS) return "tendu";
  return "confortable";
}

/**
 * Part des assignations prise par les `n` slideshows les plus tirés, sur une
 * fenêtre. 1 = un seul slideshow occupe tout le réseau, 0 = personne n'a tiré.
 *
 * C'est la mesure qui répond à « pourquoi toujours les mêmes » : avec 7
 * slideshows tirables et 40 posts par jour, le top 5 frôle les 100 %.
 */
export function concentration(passagesParContenu: number[], n = 5): number {
  const total = passagesParContenu.reduce((s, x) => s + Math.max(0, x), 0);
  if (total <= 0) return 0;
  const tete = [...passagesParContenu]
    .sort((a, b) => b - a)
    .slice(0, Math.max(1, n))
    .reduce((s, x) => s + Math.max(0, x), 0);
  return tete / total;
}

/**
 * Le goulot du moment, en une phrase — l'étage de l'entonnoir qui coûte le plus
 * de slideshows, et le geste qui le débloque.
 */
export function goulotPool(c: ComptagesPool): string {
  const tirables = tirablesMaintenant(c);
  const verrouilles = verrouillesParPriorite(c);
  const geles = horsJeu(c);

  if (c.valides === 0) {
    return "Aucun slideshow validé : le moteur n'a rien à tirer.";
  }
  if (tirables === 0) {
    return (
      "Plus aucun passage dû : le tirage en est réduit au repêchage des " +
      "slideshows en D. Valide ou importe, ou attends les requalifications."
    );
  }
  if (c.brouillons > c.valides) {
    return (
      `${c.brouillons} slideshow(s) en file de validation contre ${c.valides} ` +
      `validé(s) : c'est la validation qui tient le pool, pas la bibliothèque.`
    );
  }
  if (verrouilles > tirables) {
    return (
      `${verrouilles} slideshow(s) en C sont verrouillés tant qu'un B+ doit un ` +
      `passage — le tirage se fait sur ${tirables}. C'est voulu, mais ça ` +
      `concentre les posts et un C ne peut pas remonter sans être posté.`
    );
  }
  if (geles > tirables) {
    return (
      `${geles} slideshow(s) ont leur cycle plein et attendent une ` +
      `requalification ; seuls ${tirables} sont tirables.`
    );
  }
  return `${tirables} slideshow(s) tirables — le pool respire.`;
}
