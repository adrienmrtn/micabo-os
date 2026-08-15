import { describe, expect, it } from "vitest";

import {
  compteCorrespondFiltre,
  libelleCompteTestLibre,
  partiesCompteTestLibre,
  reactionCorrespondFiltre,
  reactionPretPourFaceSwap,
  trierComptesTestLibre,
  type CompteTestLibre,
} from "./libelleCompteTestLibre";

const labels = {
  actif: "actif",
  inactif: "inactif",
  ugcVideo: "UGC VIDEO",
  ugcSlideshow: "UGC slideshow",
  pasUgc: "pas UGC",
  sansPersona: "sans persona",
};

function compte(p: Partial<CompteTestLibre> & { id: string }): CompteTestLibre {
  return {
    persona_nom: null,
    handle_tiktok: null,
    langue: null,
    is_active: true,
    ugc_ai: false,
    ugc_ai_video: false,
    ugc_persona_id: null,
    ...p,
  };
}

describe("libelleCompteTestLibre", () => {
  it("liste un compte inactif hors UGC VIDEO sans persona", () => {
    expect(
      libelleCompteTestLibre(
        compte({
          id: "aaaaaaaa",
          persona_nom: "Léa",
          langue: "fr",
          is_active: false,
        }),
        labels,
      ),
    ).toBe("Léa · inactif · pas UGC · sans persona · fr");
  });

  it("marque UGC VIDEO + persona, sans flag sans persona", () => {
    expect(
      libelleCompteTestLibre(
        compte({
          id: "bbbbbbbb",
          handle_tiktok: "lea_tt",
          is_active: true,
          ugc_ai_video: true,
          ugc_persona_id: "persona-1",
          langue: "en",
        }),
        labels,
      ),
    ).toBe("lea_tt · actif · UGC VIDEO · en");
  });

  it("distingue UGC slideshow de UGC VIDEO", () => {
    const p = partiesCompteTestLibre(
      compte({ id: "cccccccc", persona_nom: "Sam", ugc_ai: true }),
    );
    expect(p.ugcSlideshow).toBe(true);
    expect(p.ugcVideo).toBe(false);
    expect(libelleCompteTestLibre(compte({ id: "cccccccc", persona_nom: "Sam", ugc_ai: true }), labels)).toContain(
      "UGC slideshow",
    );
  });
});

describe("trierComptesTestLibre", () => {
  it("place les actifs UGC VIDEO avant le reste", () => {
    const ids = trierComptesTestLibre([
      compte({ id: "inactif", persona_nom: "Zed", is_active: false, ugc_ai_video: true }),
      compte({ id: "actif-photo", persona_nom: "Ann", is_active: true }),
      compte({ id: "video", persona_nom: "Bo", is_active: true, ugc_ai_video: true }),
    ]).map((c) => c.id);
    expect(ids).toEqual(["video", "actif-photo", "inactif"]);
  });
});

describe("filtres", () => {
  it("filtre un compte par handle / inactif", () => {
    const c = compte({
      id: "dddddddd",
      handle_tiktok: "foo_bar",
      is_active: false,
    });
    expect(compteCorrespondFiltre(c, "FOO")).toBe(true);
    expect(compteCorrespondFiltre(c, "inactif")).toBe(true);
    expect(compteCorrespondFiltre(c, "xyz")).toBe(false);
  });

  it("n’accepte une reaction que si pret + vidéo + frame + label", () => {
    expect(
      reactionPretPourFaceSwap({
        statut: "pret",
        video_source_url: "https://x/v.mp4",
        first_frame_reference_url: "https://x/f.jpg",
        label_id: "lab",
      }),
    ).toBe(true);
    expect(
      reactionPretPourFaceSwap({
        statut: "brouillon",
        video_source_url: "https://x/v.mp4",
        first_frame_reference_url: "https://x/f.jpg",
        label_id: "lab",
      }),
    ).toBe(false);
    expect(
      reactionPretPourFaceSwap({
        statut: "pret",
        video_source_url: "https://x/v.mp4",
        first_frame_reference_url: null,
        label_id: "lab",
      }),
    ).toBe(false);
  });

  it("filtre une reaction par titre", () => {
    expect(
      reactionCorrespondFiltre({ id: "r1", titre: "Wow café", labelNom: "Food" }, "cafe"),
    ).toBe(true);
    expect(
      reactionCorrespondFiltre({ id: "r1", titre: "Wow café", labelNom: "Food" }, "sport"),
    ).toBe(false);
  });
});
