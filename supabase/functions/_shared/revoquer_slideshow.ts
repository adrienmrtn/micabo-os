/** Motif posé quand un créateur recharge un post buggé. */
export const RAISON_RECHARGE_CREATEUR =
  "Rechargé par le créateur : slideshow buggé (texte décalé / incohérent)";

/** Motif posé quand un admin change de slideshow (incohérent / non intégrable). */
export const RAISON_REVOQ_ADMIN =
  "Révoqué à la main : incohérent / non intégrable pour Sophia";

/**
 * Un recharge créateur ne sort pas le slideshow du pool : un autre compte
 * peut encore le recevoir. Seul un admin (« Changer de slideshow ») le
 * rejette pour tout le monde.
 */
export function doitRejeterSlideshow(role: string): boolean {
  return role !== "poster";
}
