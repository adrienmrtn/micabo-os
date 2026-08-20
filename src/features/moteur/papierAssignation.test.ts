import { describe, expect, it } from "vitest";

import {
  captionDepuisLangue,
  datesFenetreParis,
  estLanguePapierPrete,
  hashtagsDepuisLangue,
  masterClipsComplets,
  pairesAssignationPapier,
  statutMasterDepuisAssets,
} from "./papierAssignation";

const fr = { id: "lang-fr", langue: "fr", statut: "ready", video_url: "https://v/fr.mp4" };
const de = { id: "lang-de", langue: "de", statut: "ready", video_url: "https://v/de.mp4" };
const enQueued = { id: "lang-en", langue: "en", statut: "voice", video_url: null };

describe("estLanguePapierPrete", () => {
  it("exige ready + url", () => {
    expect(estLanguePapierPrete(fr)).toBe(true);
    expect(estLanguePapierPrete({ ...fr, video_url: null })).toBe(false);
    expect(estLanguePapierPrete(enQueued)).toBe(false);
  });
});

describe("caption / hashtags", () => {
  it("colle hook et CTA", () => {
    expect(captionDepuisLangue({ hook: "Wow", cta: "Télécharge Sophia" })).toBe(
      "Wow\n\nTélécharge Sophia",
    );
    expect(captionDepuisLangue({ hook: "  ", cta: "Go" })).toBe("Go");
  });

  it("normalise les hashtags", () => {
    expect(hashtagsDepuisLangue(["learn", "#fyp"])).toBe("#learn #fyp");
    expect(hashtagsDepuisLangue("#a #b")).toBe("#a #b");
  });
});

describe("pairesAssignationPapier", () => {
  it("assigne chaque CM actif à sa langue prête", () => {
    const paires = pairesAssignationPapier(
      [
        { id: "cm-fr", langue: "fr", type_compte: "cm", is_active: true },
        { id: "cm-de", langue: "de", type_compte: "cm", is_active: true },
        { id: "cm-fr-2", langue: "fr", type_compte: "cm", is_active: true },
      ],
      [fr, de],
    );
    expect(paires).toEqual([
      { compteId: "cm-fr", langueId: "lang-fr", langue: "fr" },
      { compteId: "cm-de", langueId: "lang-de", langue: "de" },
      { compteId: "cm-fr-2", langueId: "lang-fr", langue: "fr" },
    ]);
  });

  it("en test, inclut un CM inactif", () => {
    const paires = pairesAssignationPapier(
      [{ id: "off", langue: "de", type_compte: "cm", is_active: false }],
      [de],
      { inclureInactifs: true },
    );
    expect(paires).toEqual([{ compteId: "off", langueId: "lang-de", langue: "de" }]);
  });

  it("ignore perso, inactifs, et langues pas prêtes", () => {
    const paires = pairesAssignationPapier(
      [
        { id: "perso", langue: "fr", type_compte: "perso", is_active: true },
        { id: "off", langue: "de", type_compte: "cm", is_active: false },
        { id: "cm-en", langue: "en", type_compte: "cm", is_active: true },
        { id: "cm-fr", langue: "fr", type_compte: "cm", is_active: true },
      ],
      [fr, de, enQueued],
    );
    expect(paires).toEqual([{ compteId: "cm-fr", langueId: "lang-fr", langue: "fr" }]);
  });
});

describe("master clips → ready", () => {
  it("un master avec tous ses clips est prêt, même si le statut DB dit encore clips", () => {
    expect(masterClipsComplets([{ clip_url: "a" }, { clip_url: "b" }])).toBe(true);
    expect(masterClipsComplets([{ clip_url: "a" }, { clip_url: null }])).toBe(false);
    expect(masterClipsComplets([])).toBe(false);
    expect(
      statutMasterDepuisAssets({ topic: "carottes", script: { title: "x" } }, [
        { image_url: "i", clip_url: "c" },
      ]),
    ).toBe("ready");
    expect(
      statutMasterDepuisAssets({ topic: "carottes", script: { title: "x" } }, [
        { image_url: "i", clip_url: null },
      ]),
    ).toBe("clips");
  });
});

describe("datesFenetreParis", () => {
  it("remonte N jours inclus aujourd'hui", () => {
    expect(datesFenetreParis("2026-08-20", 2)).toEqual(["2026-08-20", "2026-08-19"]);
    expect(datesFenetreParis("2026-03-01", 1)).toEqual(["2026-03-01"]);
  });
});
