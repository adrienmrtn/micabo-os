import { describe, expect, it } from "vitest";

import { langueInitiale } from "./langues";
import {
  bioEtudes,
  capitaliserPrenom,
  genererIdentiteMicabo,
  motsEtudes,
  prenomsPour,
  sansAccentsIdentite,
} from "./identiteApplication";
import {
  avecFileLabelsApplication,
  clePromptPertinence,
  clePromptPlacement,
  estSlugApplicationValide,
  estSlugMicabo,
  fileLabelsDeLApplication,
  normaliserSlugApplication,
  posterMatcheApplication,
  resoudreApplicationImport,
} from "./applications";

describe("langue initiale", () => {
  it("prend fr dès le chargement, sans aller-retour sur une autre langue", () => {
    expect(langueInitiale(["fr", "en", "de"], "")).toBe("fr");
    expect(langueInitiale(["en", "de"], "")).toBe("en");
    expect(langueInitiale(["fr", "en"], "en")).toBe("en");
    expect(langueInitiale([], "")).toBe("");
  });
});

describe("identite micabo", () => {
  it("forme le @ prenom.mot + 3 chiffres, le nom = prénom, bio = study tips", () => {
    const id = genererIdentiteMicabo({
      langue: "fr",
      genre: "femme",
      rng: () => 0.1,
    });
    expect(id.handle).toMatch(/^[a-z]+\.[a-z]+\d{3}$/);
    expect(id.nom).toBe(capitaliserPrenom(id.handle.split(".")[0] ?? ""));
    expect(id.bio).toBe("conseils d'études");
    expect(motsEtudes("fr").some((m) => id.handle.includes(`.${m}`))).toBe(true);
    expect(prenomsPour("fr", "femme")).toContain(sansAccentsIdentite(id.nom));
  });

  it("traduit la bio selon la langue", () => {
    expect(bioEtudes("en")).toBe("study tips");
    expect(bioEtudes("de")).toBe("lerntipps");
    expect(bioEtudes("xx")).toBe("study tips");
  });

  it("évite un @ déjà pris (racine sans chiffres)", () => {
    const id = genererIdentiteMicabo({
      langue: "en",
      genre: "homme",
      handlesPris: prenomsPour("en", "homme").flatMap((p) =>
        motsEtudes("en").map((m) => `${p}.${m}111`),
      ),
      rng: () => 0.2,
    });
    expect(id.handle).toMatch(/^[a-z]+\.[a-z]+\d{3}$/);
  });
});

describe("applications", () => {
  it("valide et normalise un slug", () => {
    expect(normaliserSlugApplication(" MiCabo ")).toBe("micabo");
    expect(estSlugApplicationValide("micabo")).toBe(true);
    expect(estSlugApplicationValide("1bad")).toBe(false);
    expect(estSlugMicabo("micabo")).toBe(true);
  });

  it("hérite l'application de la source, sinon l'id explicite, sinon le fallback", () => {
    expect(
      resoudreApplicationImport({
        sourceApplicationId: "micabo-id",
        explicitApplicationId: "autre-id",
        fallbackId: "micabo-id",
      }),
    ).toBe("micabo-id");
    expect(
      resoudreApplicationImport({
        sourceApplicationId: null,
        explicitApplicationId: "micabo-id",
        fallbackId: "autre-id",
      }),
    ).toBe("micabo-id");
    expect(
      resoudreApplicationImport({
        sourceApplicationId: "  ",
        explicitApplicationId: null,
        fallbackId: "micabo-id",
      }),
    ).toBe("micabo-id");
  });

  it("résout les clés de prompts", () => {
    expect(clePromptPertinence("micabo")).toBe("pertinence_micabo");
    expect(clePromptPlacement("micabo")).toBe("placement_micabo");
    expect(clePromptPertinence(null)).toBe("pertinence_micabo");
    expect(clePromptPlacement(undefined)).toBe("placement_micabo");
  });

  it("filtre les posters par application de leurs comptes", () => {
    const apps = [{ id: "m", slug: "micabo", nom: "micabo", created_at: "" }];
    const comptes = [{ application_id: "m", application_slug: "micabo" }];
    expect(posterMatcheApplication(comptes, "tous", apps)).toBe(true);
    expect(posterMatcheApplication(comptes, "micabo", apps)).toBe(true);
    expect(posterMatcheApplication([], "micabo", apps)).toBe(false);
  });

  it("isole les files de labels par application", () => {
    const file = {
      items: [{ label_id: "micabo-root", ugc: false }],
      par_langue: { fr: [{ label_id: "micabo-fr", ugc: false }] },
    };
    const next = avecFileLabelsApplication(file, "micabo", {
      items: [{ label_id: "micabo-1", ugc: true }],
      par_langue: {} as typeof file.par_langue,
    });
    expect(fileLabelsDeLApplication(next, "micabo").items[0]?.label_id).toBe("micabo-1");
    expect(next.items[0]?.label_id).toBe("micabo-1");
  });
});
