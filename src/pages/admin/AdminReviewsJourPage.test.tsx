import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import "@/locales";
import type { ItemFileReviewJour } from "@/features/moteur/api";
import { AdminReviewsJourPage } from "./AdminReviewsJourPage";

const itemA: ItemFileReviewJour = {
  postId: "post-a",
  passageId: "pas-a",
  contenuId: "contenu-a",
  posterId: "user-a",
  posterNom: "Ada Lovelace",
  handle: "ada_notes",
  publieUrl: "https://www.tiktok.com/@ada_notes/photo/111",
  sourceUrl: "https://www.tiktok.com/@src/photo/222",
  publieAt: "2026-09-08T10:00:00.000Z",
  titre: "Flashcards cellules",
  langue: "en",
};

const itemB: ItemFileReviewJour = {
  postId: "post-b",
  passageId: "pas-b",
  contenuId: "contenu-b",
  posterId: "user-b",
  posterNom: "Marie Curie",
  handle: "marie_revise",
  publieUrl: "https://www.tiktok.com/@marie_revise/photo/333",
  sourceUrl: "https://www.tiktok.com/@src/photo/444",
  publieAt: "2026-09-08T11:00:00.000Z",
  titre: "Révisions examen",
  langue: "fr",
};

let file: ItemFileReviewJour[] = [];

vi.mock("@/features/moteur/api", () => ({
  aujourdhuiParis: () => "2026-09-08",
  listerFileReviewsJour: vi.fn(async () => file),
  lireRemarquesReviewJour: vi.fn(async () => [
    { titre: "Hook trop petit", corps: "Le hook est trop petit, on le lit trop tard" },
    { titre: "Rythme trop lent", corps: "Rythme trop lent vs l'original" },
  ]),
  resoudreTiktok: vi.fn(async () => "111"),
  passerFileJour: vi.fn(async (postId: string) => {
    file = file.filter((x) => x.postId !== postId);
  }),
  envoyerReviewPost: vi.fn(async (input: { postId: string }) => {
    file = file.filter((x) => x.postId !== input.postId);
  }),
  ameliorerReview: vi.fn(async (texte: string) => `EN: ${texte}`),
  ecrireReglage: vi.fn(async () => undefined),
  retirerSlideshow: vi.fn(async () => ({ retires: 0, refaits: 0, publiesIntacts: 1 })),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminReviewsJourPage />
    </QueryClientProvider>,
  );
}

describe("AdminReviewsJourPage", () => {
  beforeEach(() => {
    file = [{ ...itemA }, { ...itemB }];
  });

  it("montre le premier TikTok et diminue la file au Passer", async () => {
    const { passerFileJour } = await import("@/features/moteur/api");
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Flashcards cellules")).toBeInTheDocument();
    });
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/2 TikToks (à reviewer|to review)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Passer|Skip/i }));

    await waitFor(() => {
      expect(screen.getByText("Révisions examen")).toBeInTheDocument();
    });
    expect(passerFileJour).toHaveBeenCalledWith("post-a", "2026-09-08");
    expect(screen.getByText(/1 TikTok à reviewer|1 TikTok to review/)).toBeInTheDocument();
    expect(screen.queryByText("Flashcards cellules")).not.toBeInTheDocument();
  });

  it("colle une remarque générique puis envoie la review du post", async () => {
    const { envoyerReviewPost } = await import("@/features/moteur/api");
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Flashcards cellules")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Hook trop petit" }));
    const zone = screen.getByLabelText(/Ton retour|Your note/i);
    expect((zone as HTMLTextAreaElement).value).toBe(
      "Le hook est trop petit, on le lit trop tard",
    );

    fireEvent.click(screen.getByRole("button", { name: /Envoyer au créateur|Send to creator/i }));

    await waitFor(() => {
      expect(envoyerReviewPost).toHaveBeenCalledWith(
        expect.objectContaining({
          posterId: "user-a",
          postId: "post-a",
          body: "Le hook est trop petit, on le lit trop tard",
          handleTiktok: "ada_notes",
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Révisions examen")).toBeInTheDocument();
    });
  });
  it("retire le slideshow, sort le post de la file et passe au suivant", async () => {
    const confirmer = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await screen.findByText("Flashcards cellules");

    fireEvent.click(screen.getByRole("button", { name: /Remove this slideshow/i }));

    // Le post courant est publié : le retrait ne le touche pas, c'est le skip
    // qui le sort de la file. Sans lui, l'écran ne bougerait pas.
    await waitFor(() => expect(screen.getByText("Révisions examen")).toBeTruthy());
    expect(screen.queryByText("Flashcards cellules")).toBeNull();
    confirmer.mockRestore();
  });

  it("dit clairement qu'aucun post prévu n'utilisait le slideshow", async () => {
    const confirmer = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await screen.findByText("Flashcards cellules");

    fireEvent.click(screen.getByRole("button", { name: /Remove this slideshow/i }));

    await waitFor(() =>
      expect(screen.getByText(/No scheduled post was using it/i)).toBeTruthy(),
    );
    confirmer.mockRestore();
  });

  it("ne retire rien si l'admin annule la confirmation", async () => {
    const confirmer = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    await screen.findByText("Flashcards cellules");

    fireEvent.click(screen.getByRole("button", { name: /Remove this slideshow/i }));

    await waitFor(() => expect(screen.getByText("Flashcards cellules")).toBeTruthy());
    confirmer.mockRestore();
  });
});
