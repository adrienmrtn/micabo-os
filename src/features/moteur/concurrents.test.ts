import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  appliquerVerdicts,
  CONCURRENTS_DEFAUT,
  concurrentsCites,
  reecritureAcceptable,
  retirerHashtagsConcurrents,
  slidesAJuger,
} from "./concurrents";

const C = CONCURRENTS_DEFAUT;

describe("concurrentsCites", () => {
  it("trouve les mentions réelles du corpus, suffixes et composés compris", () => {
    expect(concurrentsCites("Benutz die WILGO App.", C)).toEqual(["Wilgo"]);
    expect(concurrentsCites("nutzen die WILGO-Methode", C)).toEqual(["Wilgo"]);
    expect(concurrentsCites("sonra Wilgo'dan test çöz", C)).toEqual(["Wilgo"]);
    expect(concurrentsCites("o yüzden Anki'yi fulle.", C)).toEqual(["Anki"]);
    expect(concurrentsCites("j'ai utilisé turbo ai", C)).toEqual(["Turbo AI"]);
  });

  it("ne prend pas un nom caché dans un autre mot", () => {
    expect(concurrentsCites("Ranking des matières", C)).toEqual([]);
    expect(concurrentsCites("astral et astrologie", C)).toEqual([]);
    expect(concurrentsCites("l'appli micabo", C)).toEqual([]);
  });
});

describe("slidesAJuger", () => {
  const deck = [
    { position: 1, texte_overlay: "Top 3 des applis" },
    { position: 2, texte_overlay: "j'ai utilisé quizlet", concurrent_laisse: "j'ai utilisé quizlet" },
    { position: 3, texte_overlay: "utilise WILGO chaque jour" },
  ];

  it("ne rejuge pas un classement déjà jugé sur le même texte", () => {
    expect(slidesAJuger(deck, C)).toEqual([{ position: 3, cites: ["Wilgo"] }]);
  });

  it("rejuge si le texte a changé depuis", () => {
    const edite = [{ position: 2, texte_overlay: "utilise quizlet", concurrent_laisse: "j'ai utilisé quizlet" }];
    expect(slidesAJuger(edite, C)).toEqual([{ position: 2, cites: ["Quizlet"] }]);
  });
});

describe("reecritureAcceptable", () => {
  const avant = "#2 ceux qui ont la\nmention TB, utilisent\nla méthode WILGO";

  it("accepte le remplacement du seul nom", () => {
    expect(reecritureAcceptable(avant, "#2 ceux qui ont la\nmention TB, utilisent\nl'appli micabo", C)).toBe(true);
  });

  it("refuse une sortie vide, qui cite encore, ou avec un tiret long", () => {
    expect(reecritureAcceptable(avant, "  ", C)).toBe(false);
    expect(reecritureAcceptable(avant, "utilisent l'appli micabo, pas Wilgo", C)).toBe(false);
    expect(reecritureAcceptable(avant, "#2 ceux qui ont la mention TB — l'appli micabo", C)).toBe(false);
  });

  it("refuse une sortie qui a réécrit bien plus que le nom", () => {
    const gonflee = `${avant.replace("la méthode WILGO", "l'appli micabo")}\nEt aussi\nplein d'autres conseils en plus pour réussir ton année`;
    expect(reecritureAcceptable(avant, gonflee, C)).toBe(false);
  });
});

describe("appliquerVerdicts", () => {
  const deck = [
    { position: 1, texte_overlay: "j'ai utilisé quizlet", position_sophia: false },
    { position: 2, texte_overlay: "Faire des quiz avec\nWILGO chaque jour", position_sophia: false },
    { position: 3, texte_overlay: "Benutz WILGO", position_sophia: false },
    { position: 4, texte_overlay: "dernière slide", position_sophia: false },
  ];
  const aJuger = slidesAJuger(deck, C);

  it("remplace, mémorise le classement, refuse une réécriture fautive, ignore le reste", () => {
    const r = appliquerVerdicts(
      deck,
      aJuger,
      [
        { position: 1, decision: "laisser", texte: null },
        { position: 2, decision: "remplacer", texte: "Faire des quiz avec\nl'appli MICABO chaque jour" },
        { position: 3, decision: "remplacer", texte: "Benutz WILGO, die micabo-App" },
        { position: 4, decision: "remplacer", texte: "autre chose" },
      ],
      C,
      (t) => t.replace(/MICABO/g, "micabo"),
    );
    expect(r.slides[0]).toMatchObject({ texte_overlay: "j'ai utilisé quizlet", concurrent_laisse: "j'ai utilisé quizlet" });
    expect(r.slides[1]?.texte_overlay).toBe("Faire des quiz avec\nl'appli micabo chaque jour");
    expect(r.slides[2]?.texte_overlay).toBe("Benutz WILGO");
    expect(r.slides[3]?.texte_overlay).toBe("dernière slide");
    expect(r).toMatchObject({ remplacees: [2], laissees: [1], refusees: [3] });
  });

  it("ne laisse qu'une slide nommer micabo (0289)", () => {
    const deuxWilgo = [
      { position: 1, texte_overlay: "mes méthodes" },
      { position: 2, texte_overlay: "fais des quiz avec WILGO" },
      { position: 3, texte_overlay: "la méthode WILGO" },
    ];
    const r = appliquerVerdicts(deuxWilgo, slidesAJuger(deuxWilgo, C), [
      { position: 2, decision: "remplacer", texte: "fais des quiz avec l'appli micabo" },
      { position: 3, decision: "remplacer", texte: "l'appli micabo" },
    ], C);
    // Le plus loin garde micabo, l'autre est refusé (le modèle devait l'écrire sans marque).
    expect(r).toMatchObject({ remplacees: [3], refusees: [2] });

    const sansMarque = appliquerVerdicts(deuxWilgo, slidesAJuger(deuxWilgo, C), [
      { position: 2, decision: "remplacer", texte: "fais des quiz avec une appli" },
      { position: 3, decision: "remplacer", texte: "l'appli micabo" },
    ], C);
    expect(sansMarque).toMatchObject({ remplacees: [2, 3], refusees: [] });
  });

  it("refuse micabo quand une autre slide le cite déjà", () => {
    const place = [
      { position: 2, texte_overlay: "change tes notes en audio avec PeECH" },
      { position: 5, texte_overlay: "l'appli micabo", position_sophia: true },
    ];
    const aJ = slidesAJuger(place, C);
    expect(aJ).toEqual([{ position: 2, cites: ["PeECH"] }]);
    expect(
      appliquerVerdicts(place, aJ, [{ position: 2, decision: "remplacer", texte: "change tes notes en audio avec l'appli micabo" }], C)
        .refusees,
    ).toEqual([2]);
    expect(
      appliquerVerdicts(place, aJ, [{ position: 2, decision: "remplacer", texte: "change tes notes en audio avec une appli" }], C)
        .slides[0]?.texte_overlay,
    ).toBe("change tes notes en audio avec une appli");
  });

  it("compte comme refusée une slide soumise sans verdict", () => {
    expect(appliquerVerdicts(deck, aJuger, [], C).refusees.sort()).toEqual([1, 2, 3]);
  });
});

describe("retirerHashtagsConcurrents", () => {
  it("retire le hashtag d'un concurrent, préfixe compris, et rien d'autre", () => {
    expect(retirerHashtagsConcurrents("#Wilgo #réussite #notes", C)).toBe("#réussite #notes");
    expect(retirerHashtagsConcurrents("#wilgoapp #ankicards #ranking", C)).toBe("#ranking");
    expect(retirerHashtagsConcurrents("#révisions #bac", C)).toBe("#révisions #bac");
  });
});

describe("CONCURRENTS_DEFAUT", () => {
  it("est la liste semée par 0286 et 0289, motif pour motif", () => {
    const sql =
      readFileSync("supabase/migrations/0286_concurrents_posts.sql", "utf8") +
      readFileSync("supabase/migrations/0289_placement_seconde_moitie.sql", "utf8");
    for (const c of CONCURRENTS_DEFAUT) {
      expect(sql).toContain(`('${c.nom}', '${c.motif}'`);
    }
  });
});
