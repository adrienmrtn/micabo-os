import { describe, expect, it } from "vitest";

import { promptAmeliorerReview } from "../../../supabase/functions/_shared/ameliorer_review.ts";
import {
  estLienCourtTiktok,
  extraireIdTiktok,
} from "../../../supabase/functions/_shared/tiktok_lien.ts";
import {
  collerRemarque,
  estHorsFile,
  etapesReview,
  idDepuisTitre,
  jourParisDe,
  normaliserRemarques,
  remarquesDepuisReglage,
  REMARQUES_DEFAUT,
  snapshotRemarques,
  urlEmbedTikTok,
} from "./fileQuotidienne";

describe("jourParisDe", () => {
  it("range 23:30 Paris été dans le bon jour", () => {
    expect(jourParisDe("2026-09-08T21:30:00.000Z")).toBe("2026-09-08");
  });

  it("refuse une date invalide", () => {
    expect(jourParisDe("nope")).toBeNull();
    expect(jourParisDe(null)).toBeNull();
  });
});

describe("estHorsFile", () => {
  it("sort un post déjà reviewé ou passé", () => {
    expect(
      estHorsFile({
        postId: "a",
        publieAt: "2026-09-08T10:00:00.000Z",
        jour: "2026-09-08",
        deja: new Set(["a"]),
      }),
    ).toBe(true);
  });

  it("garde un post publié ce jour-là", () => {
    expect(
      estHorsFile({
        postId: "b",
        publieAt: "2026-09-08T10:00:00.000Z",
        jour: "2026-09-08",
        deja: new Set(),
      }),
    ).toBe(false);
  });
});

describe("remarques", () => {
  it("prend les défauts si le réglage est absent", () => {
    expect(remarquesDepuisReglage(null)).toEqual(REMARQUES_DEFAUT);
    expect(remarquesDepuisReglage(undefined)).toEqual(REMARQUES_DEFAUT);
    // Les défauts portent déjà un id : c'est lui qui tiendra la vidéo.
    expect(REMARQUES_DEFAUT.every((r) => Boolean(r.id))).toBe(true);
  });

  it("accepte une liste vide (admin a tout retiré)", () => {
    expect(remarquesDepuisReglage([])).toEqual([]);
  });

  it("migre les anciennes chaînes : titre avant virgule, corps entier", () => {
    expect(
      normaliserRemarques(["Hook trop petit, on le lit trop tard", "Musique trop basse"]),
    ).toMatchObject([
      { titre: "Hook trop petit", corps: "Hook trop petit, on le lit trop tard" },
      { titre: "Musique trop basse", corps: "Musique trop basse" },
    ]);
  });

  it("garde titre / corps d'un objet, déduplique par titre", () => {
    expect(
      normaliserRemarques([
        { titre: "Hook", corps: "Le hook est trop petit" },
        { titre: "hook", corps: "doublon" },
        { titre: "  Rythme  ", corps: "  Trop lent  " },
      ]),
    ).toMatchObject([
      { titre: "Hook", corps: "Le hook est trop petit" },
      { titre: "Rythme", corps: "Trop lent" },
    ]);
  });

  it("donne un id stable aux puces d'avant les vidéos", () => {
    const lu = () => normaliserRemarques(["Hook trop petit, on le lit trop tard"])[0].id;
    // Deux lectures du même réglage doivent rendre le même id, sinon la vidéo
    // se détacherait de sa puce d'un chargement à l'autre.
    expect(lu()).toBe(lu());
    expect(lu()).toBe("hook-trop-petit");
  });

  it("dépouille les accents plutôt que de les transformer en tirets", () => {
    expect(idDepuisTitre("Texte mal calé")).toBe("texte-mal-cale");
    expect(idDepuisTitre("Musique coupée à l'entrée")).toBe("musique-coupee-a-l-entree");
    // Un titre sans lettre latine ne donne rien : l'appelant retombe sur un
    // identifiant de secours plutôt que sur une chaîne vide.
    expect(idDepuisTitre("!!!")).toBe("");
  });

  it("garde l'id écrit en base plutôt que d'en dériver un du titre", () => {
    // C'est ce qui permet de renommer une puce sans lui faire perdre sa vidéo.
    const [r] = normaliserRemarques([
      { id: "abc-123", titre: "Titre renommé", corps: "corps" },
    ]);
    expect(r.id).toBe("abc-123");
  });

  it("transporte la vidéo, quel que soit le nommage des champs", () => {
    const [snake] = normaliserRemarques([
      { titre: "Hook", corps: "c", video_url: "https://x/v.mp4", video_path: "reviews/a.mp4" },
    ]);
    expect(snake.videoUrl).toBe("https://x/v.mp4");
    expect(snake.videoPath).toBe("reviews/a.mp4");
    const [camel] = normaliserRemarques([
      { titre: "Hook", corps: "c", videoUrl: "https://y/v.mp4" },
    ]);
    expect(camel.videoUrl).toBe("https://y/v.mp4");
  });

  it("colle une remarque sans doublon de ligne", () => {
    expect(collerRemarque("", "Hook trop petit")).toBe("Hook trop petit");
    expect(collerRemarque("Rythme lent", "Hook trop petit")).toBe("Rythme lent\nHook trop petit");
    expect(collerRemarque("Hook trop petit", "hook trop petit")).toBe("Hook trop petit");
  });
});

describe("snapshotRemarques", () => {
  it("n'emporte que ce qui sert à rejouer le retour", () => {
    expect(
      snapshotRemarques([
        {
          id: "hook",
          titre: "Hook",
          corps: "Trop petit",
          videoUrl: "https://x/v.mp4",
          videoPath: "reviews/remarques/hook.mp4",
        },
      ]),
    ).toEqual([
      { id: "hook", titre: "Hook", corps: "Trop petit", video_url: "https://x/v.mp4" },
    ]);
  });

  it("une puce sans vidéo part quand même, video_url à null", () => {
    expect(snapshotRemarques([{ id: "a", titre: "A", corps: "b" }])[0].video_url).toBeNull();
  });
});

describe("etapesReview", () => {
  const video = (id: string) => ({
    id,
    titre: id,
    corps: `corps ${id}`,
    video_url: `https://x/${id}.mp4`,
  });

  it("sans vidéo, l'écran ne change pas : une seule étape texte", () => {
    expect(etapesReview({ body: "Bien joué", remarques: [] })).toEqual([
      { type: "texte", body: "Bien joué" },
    ]);
    expect(etapesReview({ body: "Bien joué" })).toHaveLength(1);
  });

  it("enchaîne une étape par vidéo, le texte ferme la marche", () => {
    const etapes = etapesReview({ body: "Le texte", remarques: [video("hook"), video("rythme")] });
    expect(etapes.map((e) => e.type)).toEqual(["video", "video", "texte"]);
    expect(etapes[0]).toMatchObject({ id: "hook", videoUrl: "https://x/hook.mp4" });
    expect(etapes[2]).toEqual({ type: "texte", body: "Le texte" });
  });

  it("ignore une puce sans vidéo : son texte est déjà dans le corps", () => {
    const etapes = etapesReview({
      body: "Le texte",
      remarques: [{ id: "a", titre: "A", corps: "b", video_url: null }, video("hook")],
    });
    expect(etapes.map((e) => e.type)).toEqual(["video", "texte"]);
  });

  it("encaisse une colonne absente ou illisible", () => {
    expect(etapesReview({ body: "x", remarques: null })).toHaveLength(1);
    expect(etapesReview({ body: "x", remarques: "pas un tableau" })).toHaveLength(1);
  });
});

describe("urlEmbedTikTok", () => {
  it("extrait l'id photo ou vidéo", () => {
    expect(urlEmbedTikTok("https://www.tiktok.com/@x/photo/7123")).toBe(
      "https://www.tiktok.com/embed/v2/7123",
    );
    expect(urlEmbedTikTok("https://www.tiktok.com/@x/video/999?foo=1")).toBe(
      "https://www.tiktok.com/embed/v2/999",
    );
    expect(urlEmbedTikTok("https://www.tiktok.com/@x")).toBeNull();
  });

  it("lit item_id après redirection d'un lien court", () => {
    expect(
      extraireIdTiktok(
        "https://www.tiktok.com/@x/photo/7683464897522437384?_r=1&item_id=111",
      ),
    ).toBe("7683464897522437384");
    expect(extraireIdTiktok("https://www.tiktok.com/share?item_id=555")).toBe("555");
    expect(estLienCourtTiktok("https://vt.tiktok.com/ZSqSYW3rS/")).toBe(true);
    expect(estLienCourtTiktok("https://vm.tiktok.com/ZN82uCFrU/")).toBe(true);
    expect(estLienCourtTiktok("https://www.tiktok.com/@x/photo/7123")).toBe(false);
    expect(urlEmbedTikTok("https://vt.tiktok.com/ZSqSYW3rS/")).toBeNull();
  });
});

describe("promptAmeliorerReview", () => {
  it("demande de l'anglais et interdit d'inventer", () => {
    const p = promptAmeliorerReview("hook trop petit");
    expect(p).toMatch(/English only/i);
    expect(p).toMatch(/Do not add new/i);
    expect(p).toMatch(/micabo/);
    expect(p).toContain("hook trop petit");
    expect(p).not.toMatch(/sophia/i);
  });
});
