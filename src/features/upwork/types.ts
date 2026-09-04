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

export type UpworkDashboard = {
  sync: UpworkSync | null;
  missions: UpworkMission[];
  contrats: UpworkContrat[];
  alertes: UpworkAlerte[];
};

export type TotauxUpwork = {
  missionsOuvertes: number;
  missionsHmOuvertes: number;
  newApplicants: number;
  contratsActifs: number;
  alertesL2: number;
  alertesL1: number;
};
