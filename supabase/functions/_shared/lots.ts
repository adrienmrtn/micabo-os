/**
 * Lecture par lots pour les filtres `in(...)`.
 *
 * Les ids partent dans l'URL PostgREST. Mesuré sur ce projet le 20/08 :
 * 640 uuid passent, 660 renvoient 400. Un label qui grossit finit donc
 * mécaniquement par casser la requête qui le lit — et comme les erreurs
 * n'étaient pas relues, un pool plein passait pour un pool vide et minuit
 * baissait le quota des créateurs. Plus il y avait de contenu, moins il y
 * avait de posts.
 */

/** Ids par requête. Large marge sous le seuil constaté (~650). */
export const LOT_IDS = 100;

/**
 * Au-delà, une seule requête `in(...)` risque le 400. Le garde-fou de
 * `serviceClient` lève à partir de cette taille — sous le seuil réel, pour
 * attraper le problème avant PostgREST, et bien au-dessus des listes
 * légitimement bornées (slides d'un post, comptes d'une langue…).
 */
export const IN_MAX_VALEURS = 400;

export interface ReponseLot<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export function decouperEnLots<T>(items: T[], taille: number): T[][] {
  const max = Math.max(1, Math.floor(taille));
  const lots: T[][] = [];
  for (let i = 0; i < items.length; i += max) lots.push(items.slice(i, i + max));
  return lots;
}

/**
 * `in(...)` découpé, avec l'erreur remontée.
 *
 * Remonter compte autant que découper : une lecture qui échoue ne doit jamais
 * être confondue avec un résultat vide, sinon on prend des décisions (baisser
 * un quota, déclarer un pool épuisé) sur la foi d'une requête ratée.
 */
export async function lireParLots<T>(
  ids: string[],
  quoi: string,
  requete: (lot: string[]) => PromiseLike<ReponseLot<T>>,
): Promise<T[]> {
  const out: T[] = [];
  for (const lot of decouperEnLots(ids, LOT_IDS)) {
    const { data, error } = await requete(lot);
    if (error) throw new Error(`${quoi} (${lot.length} id) : ${error.message}`);
    if (data) out.push(...data);
  }
  return out;
}
