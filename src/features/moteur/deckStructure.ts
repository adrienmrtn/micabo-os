/**
 * Réexport front du module pur `_shared/deck_structure.ts`.
 *
 * Même raison que `tierlist.ts` et `qualification.ts` : l'éditeur (front) et
 * l'assignation (Edge) doivent tenir le MÊME invariant, et un module importable
 * par Vitest est la seule façon de le verrouiller par un test.
 */
export {
  realignerDeck,
  positionsOrphelines,
  type SlideDeck,
} from "../../../supabase/functions/_shared/deck_structure.ts";
