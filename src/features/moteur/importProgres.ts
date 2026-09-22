/**
 * Règle « un pas d'import a-t-il franchi son étape » — réexportée depuis le
 * module Edge pour que le front et le moteur mesurent avec le MÊME code, comme
 * `tierlist.ts` et `qualification.ts`. Deux copies divergeraient au premier
 * ajustement du plafond.
 */
export {
  decisionPas,
  etapeAChange,
  MAX_PASSES_MEME_ETAPE,
} from "../../../supabase/functions/_shared/import_progres";
export type { DecisionPas } from "../../../supabase/functions/_shared/import_progres";
