/**
 * Le calendrier du créateur se règle sur le jour de PARIS, pas sur celui du
 * téléphone.
 *
 * Le moteur date et crée les posts au jour de Paris (`date_publication_prevue`,
 * rafale de minuit Paris). La page prenait « aujourd'hui » et le mois affiché à
 * l'heure de l'appareil : en Turquie (une heure d'avance), entre minuit et 1 h,
 * « Aujourd'hui » était vide, et le 30/09 au soir la grille s'ouvrait déjà sur
 * un mois d'octobre sans aucun post. Signalé par Rana le 01/10 pour Ramazan
 * (@asya.ders680, calendrier ouvert à 00:31 heure turque) et Isil
 * (@baran.notlar863).
 *
 * Deuxième trou du même signalement : un post publié en retard (Isil publie la
 * veille pour le lendemain) n'apparaissait plus nulle part dès le lendemain.
 * « Aujourd'hui » montre donc aussi les posts non publiés des
 * `RETARD_AFFICHE_JOURS` jours précédents.
 */

/** Jours de retard encore proposés dans « Aujourd'hui » (sous la péremption, 4 j). */
export const RETARD_AFFICHE_JOURS = 2;

/** Le mois (0-11) et l'année d'un jour `YYYY-MM-DD`, sans passer par un fuseau. */
export function moisDuJour(jour: string): { annee: number; mois: number } {
  const [annee, mois] = jour.split("-").map(Number);
  return { annee: annee!, mois: (mois ?? 1) - 1 };
}

/** `jour` moins `n` jours calendaires, en `YYYY-MM-DD`. */
export function jourMoins(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

interface PostDate {
  compte_id: string | null;
  date_publication_prevue: string | null;
  publie_at: string | null;
}

/**
 * Les posts du jour (Paris) et ceux encore à publier des jours précédents.
 * Un post sans `compte_id` reste visible quel que soit le compte choisi, comme
 * dans la grille.
 */
export function postsDuJour<P extends PostDate>(
  posts: P[],
  jour: string,
  compteId: string | null | undefined,
): { duJour: P[]; enRetard: P[] } {
  const visibles = posts.filter((p) => !compteId || !p.compte_id || p.compte_id === compteId);
  const debut = jourMoins(jour, RETARD_AFFICHE_JOURS);
  const duJour = visibles.filter((p) => p.date_publication_prevue === jour);
  const enRetard = visibles
    .filter(
      (p) =>
        !p.publie_at &&
        !!p.date_publication_prevue &&
        p.date_publication_prevue < jour &&
        p.date_publication_prevue >= debut,
    )
    .sort((a, b) => a.date_publication_prevue!.localeCompare(b.date_publication_prevue!));
  return { duJour, enRetard };
}
