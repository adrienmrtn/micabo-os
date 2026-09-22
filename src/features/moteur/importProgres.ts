/**
 * Règle « un pas d'import a-t-il avancé » — réexportée depuis le module Edge
 * pour que le front et le moteur mesurent le progrès avec le MÊME code, comme
 * `tierlist.ts` et `qualification.ts`. Deux copies divergeraient au premier
 * ajustement du plafond.
 */
export {
  decisionPas,
  MAX_PAS_STERILES,
  pasAAvance,
} from "../../../supabase/functions/_shared/import_progres";
export type { DecisionPas } from "../../../supabase/functions/_shared/import_progres";
