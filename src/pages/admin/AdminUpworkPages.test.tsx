import { render, screen } from "@testing-library/react";
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
      createurs_n: 0,
      contrat_at: "2026-09-01T14:43:00Z",
      synced_at: "2026-09-04T12:00:00Z",
    },
  ],
  alertes: [],
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
      warmup_actif: false,
      premier_post_ok: false,
      synced_at: "2026-09-04T12:00:00Z",
    },
  ],
};

vi.mock("@/features/upwork/api", () => ({
  chargerUpworkDashboard: vi.fn(async () => dash),
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

describe("pages Upwork", () => {
  it("dashboard : 4 KPI + lien vers un pays", async () => {
    await i18n.changeLanguage("fr");
    wrap("/admin/upwork");
    expect(await screen.findByRole("link", { name: /france/i })).toBeInTheDocument();
    expect(screen.getByText("HM")).toBeInTheDocument();
    expect(screen.getByText("Créateurs")).toBeInTheDocument();
  });

  it("page France : timelines HM et créateur", async () => {
    await i18n.changeLanguage("fr");
    wrap("/admin/upwork/fr");
    expect(await screen.findByText("Sara Benamer")).toBeInTheDocument();
    expect(screen.getByText("Hiring Manager sur une autre app.")).toBeInTheDocument();
    expect(screen.getByText("Arisoa Estelle Rajaobelina")).toBeInTheDocument();
    expect(screen.getByText(/Phase 1/)).toBeInTheDocument();
    expect(screen.getByText(/Phase 2/)).toBeInTheDocument();
    expect(screen.queryByText(/Phase 3/)).not.toBeInTheDocument();
    expect(screen.getByText("Warmup actif")).toBeInTheDocument();
  });
});
