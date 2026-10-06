import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/locales";
import type { PublicationUgc } from "@/features/ugc/publications";
import { PosterUgcPage } from "./PosterUgcPage";

const base: PublicationUgc = {
  id: "pub-1",
  compte_id: "compte-1",
  date_publication_prevue: "2026-10-06",
  video_url: "https://cdn.example/reaction.mp4",
  demo_url: null,
  texte: "POV : t'as fini\nd'apprendre tout ton cours",
  capture_url: "https://cdn.example/capture.jpg",
  legende: "j’adore trop cette méthode 📚 #revisions",
  musique_url: null,
  statut: "assigne",
  publie_at: null,
  publie_url: null,
};

let publication: PublicationUgc = base;
const marquer = vi.fn(async (_id: string, url: string | null) => ({
  ...publication,
  statut: "publie" as const,
  publie_at: "2026-10-06T18:00:00Z",
  publie_url: url,
}));

vi.mock("@/features/ugc/publications", async (original) => ({
  ...(await original<typeof import("@/features/ugc/publications")>()),
  lirePublicationUgc: vi.fn(async () => publication),
  marquerPublicationUgc: (id: string, url: string | null) => marquer(id, url),
}));

vi.mock("@/features/moteur/api", () => ({
  mesComptes: vi.fn(async () => [{ id: "compte-1", handle_tiktok: "eva.learn" }]),
}));

vi.mock("@/features/moteur/telechargement", () => ({
  recupererFichier: vi.fn(async (_url: string, nom: string) => new File(["x"], nom, { type: "video/mp4" })),
  peutPartager: () => false,
  partagerFichiers: vi.fn(),
  telechargerFichier: vi.fn(),
}));

// La page reprend les composants de la page post, qui tirent QRCode.
vi.mock("qrcode", () => ({ default: { toDataURL: async () => "" } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/ugc/pub-1"]}>
        <Routes>
          <Route path="/ugc/:id" element={<PosterUgcPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PosterUgcPage", () => {
  beforeEach(async () => {
    publication = base;
    marquer.mockClear();
    await i18n.changeLanguage("fr");
  });

  it("montre la vidéo, le texte à coller, la capture et la légende", async () => {
    const { container } = renderPage();
    await screen.findByText("Vidéo du jour");
    expect(container.querySelector("video")?.getAttribute("src")).toBe(base.video_url);
    expect(screen.getByText(/d'apprendre tout ton cours/)).toBeTruthy();
    expect(screen.getByText("Vidéo d'origine (où poser le texte)")).toBeTruthy();
    expect(screen.getByText(base.legende)).toBeTruthy();
    // Pas de démo : pas de seconde vidéo.
    expect(container.querySelectorAll("video")).toHaveLength(1);
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: /Enregistrer la vidéo/ }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  it("montre la démo quand il y en a une", async () => {
    publication = { ...base, demo_url: "https://cdn.example/demo.mp4" };
    const { container } = renderPage();
    await screen.findByText("Démo de l'appli");
    expect(container.querySelectorAll("video")).toHaveLength(2);
  });

  it("donne le son de la vidéo d'origine à poser dans TikTok", async () => {
    publication = {
      ...base,
      musique_url: "https://www.tiktok.com/music/original-sound-studyywithsachii-7689196856089381646",
    };
    renderPage();
    await screen.findByText("Le son de la vidéo d'origine");
    expect(screen.getByText(/mets-lui le son de la vidéo d'origine/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ouvrir le son" }).getAttribute("href")).toBe(
      publication.musique_url,
    );
  });

  it("sans son connu, demande un son tendance", async () => {
    renderPage();
    await screen.findByText("Vidéo du jour");
    expect(screen.queryByText("Le son de la vidéo d'origine")).toBeNull();
    expect(screen.getByText(/ajoute un son tendance/)).toBeTruthy();
  });

  it("refuse un lien hors TikTok et publie avec un lien TikTok", async () => {
    renderPage();
    const champ = await screen.findByLabelText("Lien du post publié");
    const bouton = screen.getByRole("button", { name: "Marquer comme publié" }) as HTMLButtonElement;

    fireEvent.change(champ, { target: { value: "https://example.com/x" } });
    expect(bouton.disabled).toBe(true);

    fireEvent.change(champ, { target: { value: "https://vm.tiktok.com/ZNabc/" } });
    expect(bouton.disabled).toBe(false);
    fireEvent.click(bouton);
    await waitFor(() => expect(marquer).toHaveBeenCalledWith("pub-1", "https://vm.tiktok.com/ZNabc/"));
  });
});
