import { describe, expect, it } from "vitest";

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

  it("hérite l'application de la source, jamais Sophia par défaut", () => {
    expect(
      resoudreApplicationImport({
        sourceApplicationId: "micabo-id",
        explicitApplicationId: "sophia-id",
        fallbackId: "sophia-id",
      }),
    ).toBe("micabo-id");
    expect(
      resoudreApplicationImport({
        sourceApplicationId: null,
        explicitApplicationId: "micabo-id",
        fallbackId: "sophia-id",
      }),
    ).toBe("micabo-id");
    expect(
      resoudreApplicationImport({
        sourceApplicationId: "  ",
        explicitApplicationId: null,
        fallbackId: "sophia-id",
      }),
    ).toBe("sophia-id");
  });

  it("résout les clés de prompts", () => {
    expect(clePromptPertinence("sophia")).toBe("pertinence");
    expect(clePromptPertinence("micabo")).toBe("pertinence_micabo");
    expect(clePromptPlacement("sophia")).toBe("placement_sophia");
    expect(clePromptPlacement("micabo")).toBe("placement_micabo");
  });

  it("filtre les posters par application de leurs comptes", () => {
    const apps = [
      { id: "s", slug: "sophia", nom: "Sophia", created_at: "" },
      { id: "m", slug: "micabo", nom: "micabo", created_at: "" },
    ];
    const comptes = [
      { application_id: "s", application_slug: "sophia" },
      { application_id: "m", application_slug: "micabo" },
    ];
    expect(posterMatcheApplication(comptes, "tous", apps)).toBe(true);
    expect(posterMatcheApplication(comptes, "sophia", apps)).toBe(true);
    expect(posterMatcheApplication(comptes, "micabo", apps)).toBe(true);
    expect(posterMatcheApplication([comptes[0]!], "micabo", apps)).toBe(false);
  });

  it("isole les files de labels par application", () => {
    const file = {
      items: [{ label_id: "sophia-1", ugc: false }],
      par_langue: { fr: [{ label_id: "sophia-fr", ugc: false }] },
    };
    const next = avecFileLabelsApplication(file, "micabo", {
      items: [{ label_id: "micabo-1", ugc: true }],
      par_langue: {} as typeof file.par_langue,
    });
    expect(fileLabelsDeLApplication(next, "sophia").items[0]?.label_id).toBe("sophia-1");
    expect(fileLabelsDeLApplication(next, "micabo").items[0]?.label_id).toBe("micabo-1");
    expect(next.items[0]?.label_id).toBe("sophia-1");
  });
});
