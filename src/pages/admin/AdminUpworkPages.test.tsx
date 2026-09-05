import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import i18n from "@/locales";
import type { UpworkDashboard } from "@/features/upwork/types";
import { AdminUpworkPage } from "./AdminUpworkPage";
import { AdminUpworkPaysPage } from "./AdminUpworkPaysPage";

const dash: UpworkDashboard = {
  sync: {
    org_uid: "1990051114607612379",
    last_run_at: "2026-09-04T12:00:00Z",
    last_ok: true,
    last_detail: "6 jobs",
    updated_at: "2026-09-04T12:00:00Z",
  },
  missions: [
    {
      id: "m-fr-hm",
      job_posting_id: "job-fr-hm",
      titre: "Responsable du recrutement",
      famille: "hm",
      langue: "fr",
      statut: "PUBLISHED",
      type: "HOURLY",
      created_time: "2026-09-01T00:00:00Z",
      applicants: 14,
      new_applicants: 0,
      shortlisted: 1,
      messaged: 3,
      offered: 1,
      hired: 1,
      pending_invitations: 0,
      invites_sent: 22,
      description: null,
      job_url: "https://www.upwork.com/ab/applicants/job-fr-hm",
      synced_at: "2026-09-04T12:00:00Z",
    },
    {
      id: "m-fr-cr",
      job_posting_id: "job-fr-cr",
      titre: "TikTok Slideshow Creator (Based in France)",
      famille: "createur",
      langue: "fr",
      statut: "PUBLISHED",
      type: "HOURLY",
      created_time: "2026-09-02T00:00:00Z",
      applicants: 5,
      new_applicants: 0,
      shortlisted: 0,
      messaged: 1,
      offered: 0,
      hired: 0,
      pending_invitations: 0,
      invites_sent: 27,
      description: null,
      job_url: null,
      synced_at: "2026-09-04T12:00:00Z",
    },
  ],
  contrats: [
    {
      id: "c-sara",
      contract_id: "44414683",
      titre: "HM",
      statut: "ACTIVE",
      freelancer_nom: "Sara Benamer",
      freelancer_id: "1",
      hourly_rate: 10,
      start_date: "2026-09-01",
      profile_id: "p-sara",
      room_id: null,
      last_message_at: null,
      langue: "fr",
      job_posting_id: "job-fr-hm",
      slack_ok: true,
      slack_user_id: "U1",
      slack_at: null,
      codes_at: "2026-09-01T14:46:00Z",
      os_connecte_at: "2026-09-01T15:34:00Z",
      createurs_n: 1,
      contrat_at: "2026-09-01T14:43:00Z",
      synced_at: "2026-09-04T12:00:00Z",
    },
    {
      id: "c-rose",
      contract_id: "44443490",
      titre: "HM",
      statut: "ACTIVE",
      freelancer_nom: "Rose Vasquez",
      freelancer_id: "3",
      hourly_rate: 10,
      start_date: "2026-09-05",
      profile_id: "p-rose",
      room_id: null,
      last_message_at: null,
      langue: "fr",
      job_posting_id: "job-fr-hm",
      slack_ok: false,
      slack_user_id: null,
      slack_at: null,
      codes_at: "2026-09-05T14:00:00Z",
      os_connecte_at: null,
      createurs_n: 0,
      contrat_at: "2026-09-05T13:53:00Z",
      synced_at: "2026-09-04T12:00:00Z",
    },
  ],
  alertes: [],
  actions: [
    {
      id: "act-1",
      type: "arreter_recrutement",
      upwork_proposal_id: "p2",
      cible_nom: "Arisoa Estelle Rajaobelina",
      cible_role: "createur",
      langue: "fr",
      prompt: "Arrête le recrutement de Arisoa Estelle Rajaobelina (createur fr).",
      note: null,
      statut: "en_attente",
      demande_at: "2026-09-05T10:00:00Z",
      fait_at: null,
      resultat: null,
    },
  ],
  approches: [
    {
      id: "a-sara",
      job_posting_id: "job-fr-hm",
      contract_id: "44414683",
      upwork_proposal_id: "p1",
      upwork_freelancer_id: "1",
      upwork_profile_url: "https://www.upwork.com/ab/applicants/job-fr-hm",
      photo_url: "https://example.com/sara.jpg",
      nom: "Sara Benamer",
      role: "hm",
      statut: "hired",
      resume_discussions: "Hiring Manager sur une autre app.",
      contrat_envoye_ok: true,
      contrat_signe_ok: true,
      slack_envoye_ok: true,
      email_demande_ok: true,
      codes_ok: true,
      os_ok: true,
      slack_ok: true,
      upwork_ajoute_ok: true,
      job_createur_id: "job-fr-cr",
      profile_id: "p-sara",
      tiktok_cree_ok: false,
      tiktok_handle: null,
      warmup_actif: false,
      premier_post_ok: false,
      synced_at: "2026-09-04T12:00:00Z",
    },
    {
      id: "a-rose",
      job_posting_id: "job-fr-hm",
      contract_id: "44443490",
      upwork_proposal_id: "p-rose",
      upwork_freelancer_id: "3",
      upwork_profile_url: null,
      photo_url: null,
      nom: "Rose Vasquez",
      role: "hm",
      statut: "hired",
      resume_discussions: "Dispo tout de suite.",
      contrat_envoye_ok: true,
      contrat_signe_ok: true,
      slack_envoye_ok: false,
      email_demande_ok: true,
      codes_ok: true,
      os_ok: false,
      slack_ok: false,
      upwork_ajoute_ok: true,
      job_createur_id: "job-fr-cr",
      profile_id: "p-rose",
      tiktok_cree_ok: false,
      tiktok_handle: null,
      warmup_actif: false,
      premier_post_ok: false,
      synced_at: "2026-09-04T12:00:00Z",
    },
    {
      id: "a-ari",
      job_posting_id: "job-fr-cr",
      contract_id: null,
      upwork_proposal_id: "p2",
      upwork_freelancer_id: "2",
      upwork_profile_url: "https://www.upwork.com/ab/applicants/job-fr-cr",
      photo_url: null,
      nom: "Arisoa Estelle Rajaobelina",
      role: "createur",
      statut: "messaged",
      resume_discussions: "Vit en France, déjà fait des TikTok.",
      contrat_envoye_ok: false,
      contrat_signe_ok: false,
      slack_envoye_ok: false,
      email_demande_ok: false,
      codes_ok: false,
      os_ok: false,
      slack_ok: false,
      upwork_ajoute_ok: false,
      job_createur_id: null,
      profile_id: null,
      tiktok_cree_ok: false,
      tiktok_handle: null,
      warmup_actif: false,
      premier_post_ok: false,
      synced_at: "2026-09-04T12:00:00Z",
    },
  ],
};

vi.mock("@/features/upwork/api", () => ({
  chargerUpworkDashboard: vi.fn(async () => dash),
  marquerAjoutUpwork: vi.fn(async () => undefined),
  creerActionUpwork: vi.fn(async () => undefined),
  annulerActionUpwork: vi.fn(async () => undefined),
}));

function wrap(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/upwork" element={<AdminUpworkPage />} />
          <Route path="/admin/upwork/:langue" element={<AdminUpworkPaysPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Déplie tout ce qui est repliable, de proche en proche. */
function toutDeplier() {
  for (let garde = 0; garde < 12; garde += 1) {
    const bouton = screen.queryAllByRole("button", { name: /voir le déroulé/i })[0];
    if (!bouton) return;
    fireEvent.click(bouton);
  }
}

describe("pages Upwork", () => {
  it("dashboard : 4 KPI + lien vers un pays", async () => {
    await i18n.changeLanguage("fr");
    wrap("/admin/upwork");
    expect(await screen.findByRole("link", { name: /france/i })).toBeInTheDocument();
    expect(screen.getByText("HM")).toBeInTheDocument();
    expect(screen.getByText("Créateurs")).toBeInTheDocument();
  });

  it("dashboard : dernier passage de l’agent et prompts en attente", async () => {
    await i18n.changeLanguage("fr");
    wrap("/admin/upwork");
    expect(await screen.findByText("Dernier passage de l’agent")).toBeInTheDocument();
    expect(screen.getByText("Prompts prêts pour l’agent")).toBeInTheDocument();
    expect(screen.getByText("Arisoa Estelle Rajaobelina")).toBeInTheDocument();

    // Le prompt lui-même reste caché tant qu'on n'a pas déplié.
    expect(screen.queryByText(/Arrête le recrutement de/)).not.toBeInTheDocument();
    toutDeplier();
    expect(screen.getByText(/Arrête le recrutement de/)).toBeInTheDocument();
  });

  it("page France : replié, on ne voit que l’étape en cours", async () => {
    await i18n.changeLanguage("fr");
    wrap("/admin/upwork/fr");
    expect(await screen.findByText("Sara Benamer")).toBeInTheDocument();
    expect(screen.getByText("Rose Vasquez")).toBeInTheDocument();
    expect(screen.getAllByText(/Phase 2/)).toHaveLength(2);
    expect(screen.queryByText(/Phase 3/)).not.toBeInTheDocument();

    expect(screen.queryByText("Hiring Manager sur une autre app.")).not.toBeInTheDocument();
    expect(screen.queryByText("Warmup actif")).not.toBeInTheDocument();
    expect(screen.queryByText("Arisoa Estelle Rajaobelina")).not.toBeInTheDocument();
  });

  it("page France : déplié, la chaîne complète apparaît", async () => {
    await i18n.changeLanguage("fr");
    wrap("/admin/upwork/fr");
    await screen.findByText("Sara Benamer");
    toutDeplier();

    expect(screen.getByText("Hiring Manager sur une autre app.")).toBeInTheDocument();
    expect(screen.getAllByText("A rejoint").length).toBeGreaterThan(0);
    expect(screen.getByText("Compte TikTok créé")).toBeInTheDocument();
    expect(screen.getByText("Warmup actif")).toBeInTheDocument();
    expect(screen.getAllByText("Arisoa Estelle Rajaobelina")).toHaveLength(1);

    // Rose n'a pas le job du pays : Sara le garde.
    expect(screen.getByText(/Après le job créateurs/)).toBeInTheDocument();
  });

  it("page France : « onboarding » a disparu de la chaîne", async () => {
    await i18n.changeLanguage("fr");
    wrap("/admin/upwork/fr");
    await screen.findByText("Sara Benamer");
    toutDeplier();
    expect(screen.queryByText(/onboarding/i)).not.toBeInTheDocument();
  });
});
