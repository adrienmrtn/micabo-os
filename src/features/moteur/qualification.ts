/**
 * Règles de qualification des comptes — réexportées depuis le module Edge pour
 * que le front et le moteur jugent avec le MÊME code, comme `tierlist.ts`.
 * Deux copies divergeraient au premier ajustement de seuil.
 */
export {
  enSurveillance,
  estEnTrial,
  estQualification,
  FENETRE_POSTS,
  finSkip,
  finTrial,
  indexQualification,
  PART_BIEN,
  PART_INACTIF,
  PART_STAR,
  pireQualification,
  QUALIFICATIONS,
  qualifierCompte,
  donneesDepuisPassages,
  passagePublie,
  seuilBien,
  seuilInactif,
  seuilStar,
  SKIP_JOURS,
  TRIAL_ALERTE_HEURES,
  TRIAL_HEURES,
  trialAAlerter,
  VUES_BIEN,
  VUES_MAUVAISES,
  VUES_STAR,
  type DonneesQualification,
  type EtatSurveillance,
  type PassageJuge,
  type Qualification,
} from "../../../supabase/functions/_shared/qualification.ts";
