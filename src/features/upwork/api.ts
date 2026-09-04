import { supabase } from "@/lib/supabase/client";

import type {
  UpworkAlerte,
  UpworkApproche,
  UpworkContrat,
  UpworkDashboard,
  UpworkMission,
  UpworkSync,
} from "./types";

const MISSION_COLS =
  "id, job_posting_id, titre, famille, langue, statut, type, created_time, applicants, new_applicants, shortlisted, messaged, offered, hired, pending_invitations, invites_sent, description, job_url, synced_at";

const CONTRAT_COLS =
  "id, contract_id, titre, statut, freelancer_nom, freelancer_id, hourly_rate, start_date, profile_id, room_id, last_message_at, langue, job_posting_id, slack_ok, slack_user_id, slack_at, codes_at, os_connecte_at, createurs_n, contrat_at, synced_at";

const ALERTE_COLS =
  "id, compte_id, poster_id, nom, handle, niveau, jours_sans_post, manager_id, manager_nom, contract_id, synced_at";

const APPROCHE_COLS =
  "id, job_posting_id, contract_id, upwork_proposal_id, upwork_freelancer_id, upwork_profile_url, photo_url, nom, role, statut, resume_discussions, contrat_envoye_ok, contrat_signe_ok, slack_envoye_ok, email_demande_ok, codes_ok, os_ok, slack_ok, upwork_ajoute_ok, job_createur_id, warmup_actif, premier_post_ok, synced_at";

export async function chargerUpworkDashboard(): Promise<UpworkDashboard> {
  const [syncRes, missionsRes, contratsRes, alertesRes, approchesRes] = await Promise.all([
    supabase
      .from("upwork_sync")
      .select("org_uid, last_run_at, last_ok, last_detail, updated_at")
      .eq("id", true)
      .maybeSingle(),
    supabase.from("upwork_missions").select(MISSION_COLS).order("created_time", { ascending: false }),
    supabase.from("upwork_contrats").select(CONTRAT_COLS).order("freelancer_nom"),
    supabase
      .from("upwork_alertes")
      .select(ALERTE_COLS)
      .order("jours_sans_post", { ascending: false }),
    supabase.from("upwork_approches").select(APPROCHE_COLS).order("nom"),
  ]);
  if (syncRes.error) throw syncRes.error;
  if (missionsRes.error) throw missionsRes.error;
  if (contratsRes.error) throw contratsRes.error;
  if (alertesRes.error) throw alertesRes.error;
  if (approchesRes.error) throw approchesRes.error;

  return {
    sync: (syncRes.data as UpworkSync | null) ?? null,
    missions: (missionsRes.data ?? []) as UpworkMission[],
    contrats: (contratsRes.data ?? []) as UpworkContrat[],
    alertes: (alertesRes.data ?? []) as UpworkAlerte[],
    approches: (approchesRes.data ?? []) as UpworkApproche[],
  };
}
