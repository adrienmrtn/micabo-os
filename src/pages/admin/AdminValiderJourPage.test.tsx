import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/locales";
import type { ItemValidationJour } from "@/features/validation/fileJour";
import type { PostSlide } from "@/features/moteur/types";
import { AdminValiderJourPage } from "./AdminValiderJourPage";

const itemA: ItemValidationJour = {
  postId: "post-a",
  passageId: "pas-a",
  contenuId: "contenu-a",
  compteId: "c-a",
  posterNom: "Ada Lovelace",
  handle: "ada_notes",
  sourceUrl: "https://www.tiktok.com/@src/video/222",
  titre: "Flashcards cellules",
  langue: "en",
  type: "contenu",
  statut: "assigne",
  slideshowVide: false,
};

const itemB: ItemValidationJour = {
  postId: "post-b",
  passageId: "pas-b",
  contenuId: "contenu-b",
  compteId: "c-b",
  posterNom: "Marie Curie",
  handle: "marie_revise",
  sourceUrl: "https://www.tiktok.com/@src/video/444",
  titre: "Révisions examen",
  langue: "fr",
  type: "contenu",
  statut: "assigne",
  slideshowVide: false,
};

let file: ItemValidationJour[] = [];

const slide: PostSlide = {
  id: "slide-1",
  post_id: "post-a",
  position: 1,
  media_id: "m1",
  texte_overlay: "Révise 10 min",
  position_sophia: false,
  reference_url: null,
  media_library: {
    url: "https://example.com/slide.jpg",
    storage_path: "propre/x.jpg",
    upscale_le: null,
  },
};

vi.mock("@/features/validation/fileJourListe", () => ({
  listerFileValidationJour: vi.fn(async () => file),
  marquerValideJour: vi.fn(async (postId: string) => {
    file = file.filter((x) => x.postId !== postId);
  }),
}));

vi.mock("@/features/moteur/api", async () => {
  const actual = await vi.importActual<typeof import("@/features/moteur/api")>(
    "@/features/moteur/api",
  );
  return {
    ...actual,
    aujourdhuiParis: () => "2026-09-10",
    listerSlides: vi.fn(async () => [slide]),
    compteReferenceDuPost: vi.fn(async () => null),
    listerMediasPourContenu: vi.fn(async () => [
      {
        id: "m-biblio",
        url: "https://example.com/biblio.jpg",
        storage_path: "propre/y.jpg",
      },
    ]),
    listerMedias: vi.fn(async () => []),
    majMediaSlide: vi.fn(async () => undefined),
    lireReglages: vi.fn(async () => ({
      nettoyage: { provider_principal: "fal" },
    })),
    revoquerPost: vi.fn(),
    avancerUnPost: vi.fn(),
  };
});

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
        <AdminValiderJourPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminValiderJourPage", () => {
  beforeEach(() => {
    file = [{ ...itemA }, { ...itemB }];
    vi.clearAllMocks();
  });

  it("montre le premier slideshow avec texte et origin, Valider avance la pile", async () => {
    const { marquerValideJour } = await import("@/features/validation/fileJourListe");
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Flashcards cellules/)).toBeInTheDocument();
    });
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getAllByText("Révise 10 min").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId(/embed-(TikTok d'origine|Original TikTok)/)).toHaveTextContent(
      "https://www.tiktok.com/@src/video/222",
    );
    expect(screen.getByText(/2 passages (à valider|to check)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Valider|Mark OK/i }));

    await waitFor(() => {
      expect(screen.getByText(/Révisions examen/)).toBeInTheDocument();
    });
    expect(marquerValideJour).toHaveBeenCalledWith("post-a", "2026-09-10");
    expect(screen.queryByText("Flashcards cellules")).not.toBeInTheDocument();
  });

  it("Plus tard fait tourner le focus sans valider", async () => {
    const { marquerValideJour } = await import("@/features/validation/fileJourListe");
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Plus tard|Later/i }));

    await waitFor(() => {
      expect(screen.getByText("Marie Curie")).toBeInTheDocument();
    });
    expect(marquerValideJour).not.toHaveBeenCalled();
    expect(screen.getByText(/Révisions examen/)).toBeInTheDocument();
  });

  it("montre l'état vide s'il n'y a plus rien à valider", async () => {
    file = [];
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Pile vide|Nothing left to check/)).toBeInTheDocument();
    });
  });

  it("Replace the photo reste cliquable sans compte de référence", async () => {
    const { listerMediasPourContenu, majMediaSlide } = await import(
      "@/features/moteur/api"
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    });
    const bouton = screen.getByRole("button", {
      name: /Remplacer la photo|Replace the photo/i,
    });
    expect(bouton).not.toBeDisabled();
    fireEvent.click(bouton);

    await waitFor(() => {
      expect(
        screen.getByText(/Choisir une photo|Choose a photo/i),
      ).toBeInTheDocument();
    });
    expect(listerMediasPourContenu).toHaveBeenCalledWith("contenu-a");

    const mini = await waitFor(() => {
      const photos = screen.getAllByRole("button");
      const found = photos.find((el) =>
        el.querySelector("img[src='https://example.com/biblio.jpg']"),
      );
      expect(found).toBeTruthy();
      return found!;
    });
    fireEvent.click(mini);

    await waitFor(() => {
      expect(majMediaSlide).toHaveBeenCalledWith("slide-1", "m-biblio");
    });
  });
});
