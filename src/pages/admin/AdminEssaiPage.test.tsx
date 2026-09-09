import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/locales";
import type { CompteEssai } from "@/features/moteur/essai";
import { AdminEssaiPage } from "./AdminEssaiPage";

const created = new Date(Date.now() - 36 * 3_600_000).toISOString();

const compte: CompteEssai = {
  id: "compte-1",
  created_at: created,
  essai_ends_at: new Date(Date.parse(created) + 5 * 86_400_000).toISOString(),
  restant_ms: 4 * 86_400_000,
  poster_id: "user-1",
  poster_prenom: "Inès",
  poster_nom: "Cours",
  poster_email: "ines@example.com",
  persona_nom: "Inès",
  handle_tiktok: "ines.cours260",
  avatar_url: null,
  langue: "fr",
  posts_par_jour: 2,
  publies: 2,
  dus: 4,
  vues: 1200,
  likes: 80,
  commentaires: 3,
  partages: 1,
  derniers: [
    {
      postId: "post-1",
      publieUrl: "https://www.tiktok.com/@ines.cours260/video/111",
      sourceUrl: "https://www.tiktok.com/@src/video/222",
      titre: "Flashcards cellules",
      publieAt: "2026-09-09T10:00:00.000Z",
    },
  ],
};

let comptes: CompteEssai[] = [];

vi.mock("@/features/moteur/essaiListe", () => ({
  listerComptesEssai: vi.fn(async () => comptes),
}));

vi.mock("@/features/reviews/TikTokEmbed", () => ({
  TikTokEmbed: ({ url, label }: { url: string | null; label: string }) => (
    <div data-testid={`embed-${label}`}>{url}</div>
  ),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminEssaiPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminEssaiPage", () => {
  beforeEach(() => {
    comptes = [{ ...compte, derniers: [...compte.derniers] }];
  });

  it("liste un compte en essai avec publiés/dus, stats et comparaison", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Inès Cours")).toBeInTheDocument();
    });
    expect(screen.getByText("@ines.cours260")).toBeInTheDocument();
    expect(screen.getByText("2/4")).toBeInTheDocument();
    expect(screen.getByText("Flashcards cellules")).toBeInTheDocument();
    expect(screen.getByText(/1 compte en essai|1 trial account/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Comparer à l'origine|Compare to original/i }));

    await waitFor(() => {
      expect(screen.getByTestId(/embed-(TikTok d'origine|Original TikTok)/)).toHaveTextContent(
        "https://www.tiktok.com/@src/video/222",
      );
    });
    expect(screen.getByTestId(/embed-(TikTok posté|Posted TikTok)/)).toHaveTextContent(
      "https://www.tiktok.com/@ines.cours260/video/111",
    );
  });

  it("montre l'état vide s'il n'y a personne en essai", async () => {
    comptes = [];
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Aucun compte en essai|No trial accounts/)).toBeInTheDocument();
    });
  });
});
