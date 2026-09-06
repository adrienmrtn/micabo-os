import { supabase } from "@/lib/supabase/client";

import type { UpworkModele } from "./modeles";
import { CLES_DOCS_UPWORK, CONSIGNE_DEFAUT, type DocSavoir } from "./savoir";
import type {
  TypeAction,
  UpworkAction,
  UpworkAlerte,
  UpworkApproche,
  UpworkCampagne,
  UpworkCandidat,
  UpworkContrat,
  UpworkDashboard,
  UpworkMission,
  UpworkSync,
  LigneSurveillance,
} from "./types";

const MISSION_COLS =
  "id, job_posting_id, titre, famille, langue, statut, type, created_time, applicants, new_applicants, shortlisted, messaged, offered, hired, pending_invitations, invites_sent, description, job_url, synced_at";

const CONTRAT_COLS =
  "id, contract_id, titre, statut, freelancer_nom, freelancer_id, hourly_rate, start_date, profile_id, room_id, last_message_at, langue, job_posting_id, slack_ok, slack_user_id, slack_at, codes_at, os_connecte_at, createurs_n, contrat_at, synced_at";

const ALERTE_COLS =
  "id, compte_id, poster_id, nom, handle, niveau, jours_sans_post, manager_id, manager_nom, contract_id, synced_at";

const APPROCHE_COLS =
  "id, job_posting_id, contract_id, upwork_proposal_id, upwork_freelancer_id, upwork_profile_url, photo_url, nom, role, statut, resume_discussions, dernier_message, dernier_message_at, offre_finalize_url, contrat_envoye_ok, contrat_signe_ok, slack_envoye_ok, email_demande_ok, codes_ok, os_ok, slack_ok, upwork_ajoute_ok, job_createur_id, profile_id, tiktok_cree_ok, tiktok_handle, warmup_actif, premier_post_ok, arrete_ok, synced_at";

const ACTION_COLS =
  "id, type, campagne_id, upwork_proposal_id, cible_nom, cible_role, langue, prompt, message, note, statut, demande_at, fait_at, resultat";

const MODELE_COLS = "id, cle, role_cible, langue, corps, maj_at";

const CAMPAGNE_COLS =
  "id, langue, pays_nom, role_cible, statut, job_posting_id, objectif_hm, profils_par_passage, delai_validation_h, lance_at, job_publie_at, fin_at, detail";

const CANDIDAT_COLS =
  "id, campagne_id, upwork_person_id, nom, titre_profil, photo_url, upwork_profile_url, pays, taux_horaire, job_success, pourquoi, statut, auto_valide, propose_at, echeance_at, decide_at, invite_at";

export async function chargerUpworkDashboard(): Promise<UpworkDashboard> {
  const [
    syncRes,
    missionsRes,
    contratsRes,
    alertesRes,
    approchesRes,
    actionsRes,
    campagnesRes,
    candidatsRes,
    modelesRes,
    accesRes,
    surveillanceRes,
    docsRes,
  ] = await Promise.all([
      supabase
        .from("upwork_sync")
        .select("org_uid, last_run_at, last_ok, last_detail, updated_at")
        .eq("id", true)
        .maybeSingle(),
      supabase
        .from("upwork_missions")
        .select(MISSION_COLS)
        .order("created_time", { ascending: false }),
      supabase.from("upwork_contrats").select(CONTRAT_COLS).order("freelancer_nom"),
      supabase
        .from("upwork_alertes")
        .select(ALERTE_COLS)
        .order("jours_sans_post", { ascending: false }),
      supabase.from("upwork_approches").select(APPROCHE_COLS).order("nom"),
      supabase
        .from("upwork_actions")
        .select(ACTION_COLS)
        .order("demande_at", { ascending: false }),
      supabase
        .from("upwork_campagnes")
        .select(CAMPAGNE_COLS)
        .order("lance_at", { ascending: false }),
      supabase
        .from("upwork_candidats")
        .select(CANDIDAT_COLS)
        .order("propose_at", { ascending: false }),
      supabase.from("upwork_modeles").select(MODELE_COLS).order("cle"),
      supabase.rpc("upwork_acces_reglages"),
      supabase.rpc("upwork_surveillance"),
      supabase
        .from("documents")
        .select("cle, titre, contenu, contenu_en")
        .in("cle", [...CLES_DOCS_UPWORK]),
    ]);
  if (syncRes.error) throw syncRes.error;
  if (missionsRes.error) throw missionsRes.error;
  if (contratsRes.error) throw contratsRes.error;
  if (alertesRes.error) throw alertesRes.error;
  if (approchesRes.error) throw approchesRes.error;
  if (actionsRes.error) throw actionsRes.error;
  if (campagnesRes.error) throw campagnesRes.error;
  if (candidatsRes.error) throw candidatsRes.error;
  if (modelesRes.error) throw modelesRes.error;
  if (accesRes.error) throw accesRes.error;
  if (surveillanceRes.error) throw surveillanceRes.error;
  if (docsRes.error) throw docsRes.error;

  const accesBrut = (accesRes.data ?? {}) as {
    slack_invite_manager?: string;
    os_url?: string;
    consigne?: string;
  };

  return {
    sync: (syncRes.data as UpworkSync | null) ?? null,
    missions: (missionsRes.data ?? []) as UpworkMission[],
    contrats: (contratsRes.data ?? []) as UpworkContrat[],
    alertes: (alertesRes.data ?? []) as UpworkAlerte[],
    approches: (approchesRes.data ?? []) as UpworkApproche[],
    actions: (actionsRes.data ?? []) as UpworkAction[],
    campagnes: (campagnesRes.data ?? []) as UpworkCampagne[],
    candidats: (candidatsRes.data ?? []) as UpworkCandidat[],
    modeles: (modelesRes.data ?? []) as UpworkModele[],
    acces: {
      slack_invite_manager: accesBrut.slack_invite_manager ?? "",
      os_url: accesBrut.os_url ?? "https://os.micabo.app/login",
      consigne: accesBrut.consigne?.trim() || CONSIGNE_DEFAUT,
    },
    documents: (docsRes.data ?? []) as DocSavoir[],
    surveillance: (surveillanceRes.data ?? []) as LigneSurveillance[],
  };
}

export async function sauverAccesUpwork(valeur: {
  slack_invite_manager?: string;
  os_url?: string;
  consigne?: string;
}): Promise<void> {
  const { error } = await supabase.rpc("upwork_acces_reglages_sauver", {
    p_valeur: valeur,
  });
  if (error) throw error;
}

/**
 * Le texte relu par l'admin part tel quel dans la file : l'agent l'envoie sur
 * Upwork sans le retoucher.
 */
export async function envoyerMessageUpwork(proposalId: string, corps: string): Promise<void> {
  const { error } = await supabase.rpc("upwork_message_envoyer", {
    p_proposal_id: proposalId,
    p_corps: corps,
  });
  if (error) throw error;
}

/** Le MCP ne sait faire qu'un brouillon : l'agent prépare, l'admin envoie. */
export async function preparerContratUpwork(proposalId: string): Promise<void> {
  const { error } = await supabase.rpc("upwork_contrat_preparer", {
    p_proposal_id: proposalId,
  });
  if (error) throw error;
}

export async function enregistrerModele(
  modele: Pick<UpworkModele, "cle" | "role_cible" | "langue"> & { corps: string },
): Promise<void> {
  const { error } = await supabase.from("upwork_modeles").upsert(
    {
      cle: modele.cle,
      role_cible: modele.role_cible,
      langue: modele.langue,
      corps: modele.corps,
      maj_at: new Date().toISOString(),
    },
    { onConflict: "cle,role_cible,langue" },
  );
  if (error) throw error;
}

/** Lance le recrutement HM d'un pays : l'OS pose l'état, l'agent exécute. */
export async function lancerCampagneHm(
  langue: string,
  paysNom: string,
  delaiH = 10,
): Promise<void> {
  const { error } = await supabase.rpc("upwork_campagne_lancer", {
    p_langue: langue,
    p_pays_nom: paysNom,
    p_objectif: 1,
    p_delai_h: delaiH,
  });
  if (error) throw error;
}

export async function arreterCampagneHm(id: string): Promise<void> {
  const { error } = await supabase.rpc("upwork_campagne_arreter", { p_id: id });
  if (error) throw error;
}

/** Sans décision avant l'échéance, le profil part quand même. */
export async function deciderCandidat(id: string, ok: boolean): Promise<void> {
  const { error } = await supabase.rpc("upwork_candidat_decider", { p_id: id, p_ok: ok });
  if (error) throw error;
}

/** Cases cochées à la main : Upwork account, et contrat envoyé. */
export async function marquerAjoutUpwork(proposalId: string, ok: boolean): Promise<void> {
  const { error } = await supabase.rpc("upwork_marquer_flag", {
    p_proposal_id: proposalId,
    p_flag: "upwork_ajoute_ok",
    p_ok: ok,
  });
  if (error) throw error;
}

export async function marquerContratEnvoye(proposalId: string, ok: boolean): Promise<void> {
  const { error } = await supabase.rpc("upwork_marquer_flag", {
    p_proposal_id: proposalId,
    p_flag: "contrat_envoye_ok",
    p_ok: ok,
  });
  if (error) throw error;
}

/** Slack + demande email + codes OS : l'agent le fait, ou l'admin coche si ça a déjà été fait. */
export async function marquerAccesEnvoyes(proposalId: string, ok: boolean): Promise<void> {
  const { error } = await supabase.rpc("upwork_marquer_flag", {
    p_proposal_id: proposalId,
    p_flag: "acces_envoyes",
    p_ok: ok,
  });
  if (error) throw error;
}

/** Empile un prompt : l'OS n'exécute rien, l'agent le prendra au passage suivant. */
export async function creerActionUpwork(
  type: TypeAction,
  proposalId: string,
  note?: string,
): Promise<void> {
  const { error } = await supabase.rpc("upwork_action_creer", {
    p_type: type,
    p_proposal_id: proposalId,
    p_note: note?.trim() || null,
  });
  if (error) throw error;
}

export async function annulerActionUpwork(id: string): Promise<void> {
  const { error } = await supabase.rpc("upwork_action_annuler", { p_id: id });
  if (error) throw error;
}
