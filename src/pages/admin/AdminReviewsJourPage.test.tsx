import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import "@/locales";
import type { ItemFileReviewJour } from "@/features/moteur/api";
import { AdminReviewsJourPage } from "./AdminReviewsJourPage";

const itemA: ItemFileReviewJour = {
  postId: "post-a",
  passageId: "pas-a",
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
  lireRemarquesReviewJour: vi.fn(async () => ["Hook trop petit", "Rythme trop lent"]),
  passerFileJour: vi.fn(async (postId: string) => {
    file = file.filter((x) => x.postId !== postId);
  }),
  envoyerReviewPost: vi.fn(async (input: { postId: string }) => {
    file = file.filter((x) => x.postId !== input.postId);
  }),
  ameliorerReview: vi.fn(async (texte: string) => `EN: ${texte}`),
  ecrireReglage: vi.fn(async () => undefined),
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
    expect((zone as HTMLTextAreaElement).value).toBe("Hook trop petit");

    fireEvent.click(screen.getByRole("button", { name: /Envoyer au créateur|Send to creator/i }));

    await waitFor(() => {
      expect(envoyerReviewPost).toHaveBeenCalledWith(
        expect.objectContaining({
          posterId: "user-a",
          postId: "post-a",
          body: "Hook trop petit",
          handleTiktok: "ada_notes",
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Révisions examen")).toBeInTheDocument();
    });
  });
});
