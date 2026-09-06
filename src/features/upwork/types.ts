import type { UpworkModele } from "./modeles";
import type { DocSavoir } from "./savoir";

export type FamilleMission = "hm" | "createur" | "autre";

export type UpworkSync = {
  org_uid: string;
  last_run_at: string | null;
  last_ok: boolean | null;
  last_detail: string | null;
  updated_at: string;
};

export type UpworkMission = {
  id: string;
  job_posting_id: string;
  titre: string;
  famille: FamilleMission;
  langue: string | null;
  statut: string | null;
  type: string | null;
  created_time: string | null;
  applicants: number;
  new_applicants: number;
  shortlisted: number;
  messaged: number;
  offered: number;
  hired: number;
  pending_invitations: number;
  invites_sent: number;
  description: string | null;
  job_url: string | null;
  synced_at: string;
};

export type UpworkContrat = {
  id: string;
  contract_id: string;
  titre: string | null;
  statut: string | null;
  freelancer_nom: string | null;
  freelancer_id: string | null;
  hourly_rate: number | null;
  start_date: string | null;
  profile_id: string | null;
  room_id: string | null;
  last_message_at: string | null;
  langue: string | null;
  job_posting_id: string | null;
  slack_ok: boolean;
  slack_user_id: string | null;
  slack_at: string | null;
  codes_at: string | null;
  os_connecte_at: string | null;
  createurs_n: number;
  contrat_at: string | null;
  synced_at: string;
};

export type UpworkAlerte = {
  id: string;
  compte_id: string;
  poster_id: string | null;
  nom: string | null;
  handle: string | null;
  niveau: "l1" | "l2";
  jours_sans_post: number;
  manager_id: string | null;
  manager_nom: string | null;
  contract_id: string | null;
  synced_at: string;
};

export type UpworkApproche = {
  id: string;
  job_posting_id: string;
  contract_id: string | null;
  upwork_proposal_id: string;
  upwork_freelancer_id: string | null;
  upwork_profile_url: string | null;
  photo_url: string | null;
  nom: string;
  role: "hm" | "createur";
  statut: "messaged" | "offered" | "hired";
  resume_discussions: string | null;
  /** Dernier message d'eux, verbatim. Talks l'affiche et la réponse s'appuie dessus. */
  dernier_message: string | null;
  dernier_message_at: string | null;
  /** Rendue par Upwork quand l'agent a préparé le brouillon d'offre. */
  offre_finalize_url: string | null;
  contrat_envoye_ok: boolean;
  contrat_signe_ok: boolean;
  slack_envoye_ok: boolean;
  email_demande_ok: boolean;
  codes_ok: boolean;
  os_ok: boolean;
  slack_ok: boolean;
  upwork_ajoute_ok: boolean;
  job_createur_id: string | null;
  profile_id: string | null;
  tiktok_cree_ok: boolean;
  tiktok_handle: string | null;
  warmup_actif: boolean;
  premier_post_ok: boolean;
  synced_at: string;
};

export type TypeAction =
  | "arreter_recrutement"
  | "publier_job_hm"
  | "sourcer_hm"
  | "inviter_hm"
  | "envoyer_message"
  | "preparer_contrat"
  | "envoyer_acces_hm";

/** Une action déclenchée dans l'OS = un prompt figé, en attente de l'agent. */
export type UpworkAction = {
  id: string;
  type: TypeAction;
  campagne_id: string | null;
  upwork_proposal_id: string | null;
  cible_nom: string;
  cible_role: "hm" | "createur" | null;
  langue: string | null;
  prompt: string;
  /** Le texte exact à envoyer sur Upwork, relu par l'admin avant la file. */
  message: string | null;
  note: string | null;
  statut: "en_attente" | "fait" | "annule";
  demande_at: string;
  fait_at: string | null;
  resultat: string | null;
};

/** Recrutement HM d'un pays, piloté par l'OS et exécuté par l'agent. */
export type UpworkCampagne = {
  id: string;
  langue: string;
  pays_nom: string | null;
  role_cible: "hm";
  statut: "active" | "en_pause" | "terminee" | "arretee";
  job_posting_id: string | null;
  objectif_hm: number;
  profils_par_passage: number;
  delai_validation_h: number;
  lance_at: string;
  job_publie_at: string | null;
  fin_at: string | null;
  detail: string | null;
};

/** Profil recommandé par l'agent, à valider avant invitation. */
export type UpworkCandidat = {
  id: string;
  campagne_id: string;
  upwork_person_id: string;
  nom: string;
  titre_profil: string | null;
  photo_url: string | null;
  upwork_profile_url: string | null;
  pays: string | null;
  taux_horaire: number | null;
  job_success: number | null;
  pourquoi: string | null;
  statut: "propose" | "valide" | "refuse" | "invite";
  auto_valide: boolean;
  propose_at: string;
  echeance_at: string;
  decide_at: string | null;
  invite_at: string | null;
};

/** Stats OS d’un compte créateur déjà passé en phase 3 (premier post). */
export type LigneSurveillance = {
  compte_id: string;
  poster_id: string | null;
  manager_id: string | null;
  nom: string | null;
  handle: string | null;
  posts_par_jour: number;
  posts_10j: number;
  prevus_10j: number;
  vues_10: number;
  posts_mesures: number;
  elo: number;
};

export type UpworkDashboard = {
  sync: UpworkSync | null;
  missions: UpworkMission[];
  contrats: UpworkContrat[];
  alertes: UpworkAlerte[];
  approches: UpworkApproche[];
  actions: UpworkAction[];
  campagnes: UpworkCampagne[];
  candidats: UpworkCandidat[];
  modeles: UpworkModele[];
  acces: { slack_invite_manager: string; os_url: string; consigne: string };
  documents: DocSavoir[];
  surveillance: LigneSurveillance[];
};

export type TotauxPays = {
  langue: string;
  hms: number;
  createurs: number;
  jobsHmOuverts: number;
  jobsCreateursOuverts: number;
};

export type TotauxUpwork = {
  hms: number;
  createurs: number;
  jobsHmOuverts: number;
  jobsCreateursOuverts: number;
  parPays: TotauxPays[];
};
