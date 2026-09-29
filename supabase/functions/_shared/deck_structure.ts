/**
 * L'invariant que personne ne tenait : un slideshow est DEUX listes.
 *
 * `contenus.structure_slides` porte les IMAGES, `contenu_langues.slides` porte
 * les TEXTES, et elles doivent avoir la même longueur et le même ordre. Rien ne
 * le vérifiait — ni à l'écriture, ni à la livraison.
 *
 * Le 29/09/2026, sur `b1bc3cb3` : le TikTok d'origine avait 6 images, toutes
 * en base (`propre/1` à `propre/6`). `structure_slides` n'en listait plus que
 * **5**, et ses positions 4 et 5 pointaient sur `propre/5` et `propre/6` — la
 * 4ᵉ image avait été retirée et les suivantes renumérotées. Le deck, lui, avait
 * gardé ses 6 entrées.
 *
 * Résultat livré aux créateurs : les textes ne suivaient plus les images à
 * partir de la suppression, le dernier texte sortait DEUX fois, et la 6ᵉ slide
 * partait sans aucune image. Un seul défaut, trois symptômes — c'est pour ça
 * qu'on avait d'abord cru à deux problèmes distincts.
 *
 * L'éditeur de `/admin/file` en est la source : sa sauvegarde réécrit la
 * structure (suppression + renumérotation) puis pousse les textes **position
 * par position** via `majTexteSlideDeck`, qui ne sait qu'ÉCRASER une position.
 * Elle ne raccourcit jamais le tableau, et elle ne touche que le deck SOURCE —
 * les decks traduits gardaient l'ancien alignement, d'où 11 créateurs de
 * langues différentes servis avec le même trou.
 *
 * Ces deux fonctions sont PURES : elles tiennent l'invariant des deux côtés,
 * à l'écriture (l'éditeur) et à la livraison (l'assignation).
 */

export type SlideDeck = {
  position: number;
  texte_overlay?: string | null;
  position_sophia?: boolean;
};

/**
 * Remet un deck en face de la structure après une suppression ou un
 * réordonnancement.
 *
 * `ordreAncien[i]` est l'ANCIENNE position de la slide qui occupe désormais la
 * position `i + 1`. Le tableau rendu a donc exactement `ordreAncien.length`
 * entrées : les textes des slides supprimées disparaissent, les autres suivent
 * leur image.
 *
 * **On remappe, on ne retraduit pas.** Un texte traduit est du crédit Gemini
 * déjà payé et une slide qui performe ; il n'a pas changé de sens parce que sa
 * voisine est partie. Vider les decks traduits (la règle des bascules de
 * marque) ne vaut que quand la SOURCE change de sens — ici elle ne change pas,
 * elle se raccourcit.
 *
 * Une position absente du deck rend une entrée à texte vide plutôt que rien :
 * décaler d'un cran pour compenser un trou reproduirait exactement le défaut
 * qu'on ferme.
 */
export function realignerDeck(slides: SlideDeck[], ordreAncien: number[]): SlideDeck[] {
  const parPos = new Map(slides.map((s) => [Number(s.position), s]));
  return ordreAncien.map((ancienne, i) => {
    const s = parPos.get(Number(ancienne));
    return {
      ...(s ?? {}),
      position: i + 1,
      texte_overlay: s?.texte_overlay ?? "",
      position_sophia: Boolean(s?.position_sophia),
    };
  });
}

/**
 * Positions du deck qu'aucune image ne porte — le défaut, vu à la livraison.
 *
 * Purement en mémoire, sur des données déjà lues. C'est délibéré : 0265 a
 * RETIRÉ la pré-vérification d'existence des médias en TS, parce qu'elle
 * ouvrait une fenêtre entre la lecture et l'écriture où une FK violée passait.
 * On ne la réintroduit pas. Un média effacé de `media_library` reste géré par
 * le `left join` de `creer_publication_atomique`, qui écrit NULL ; ici on ne
 * juge que la cohérence des deux listes, qu'aucune course ne peut changer.
 */
export function positionsOrphelines(
  slides: Array<{ position: number }>,
  structure: Array<{ position: number }>,
): number[] {
  const connues = new Set(structure.map((s) => Number(s.position)));
  return slides
    .map((s) => Number(s.position))
    .filter((p) => !connues.has(p));
}
