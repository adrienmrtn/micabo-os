import { describe, expect, it } from "vitest";

import {
  nettoyerTexteDeck,
  normaliserMarque,
  retirerTiretsLongs,
} from "../../../supabase/functions/_shared/marque";

describe("normaliserMarque — casse", () => {
  it("rend la marque en minuscules, même en tête de phrase", () => {
    // Les 14 fautes relevées en base le 17/09 étaient toutes de cette forme,
    // et toutes dans des decks en langue source.
    expect(normaliserMarque("Prépare tes exams avec Micabo", "fr")).toContain("micabo");
    expect(normaliserMarque("Prépare tes exams avec Micabo", "fr")).not.toContain("Micabo");
    expect(normaliserMarque("MICABO (AI Tool)", "en")).not.toContain("MICABO");
  });

  it("corrige la casse même quand la catégorie est déjà là", () => {
    // Le cas « use apps like Micabo » : on saute l'article, pas la casse.
    expect(normaliserMarque("use apps like Micabo", "en")).toBe("use apps like micabo");
  });
});

describe("normaliserMarque — mot de catégorie", () => {
  it("ajoute l'article par langue", () => {
    expect(normaliserMarque("j'utilise micabo", "fr")).toBe("j'utilise l'appli micabo");
    expect(normaliserMarque("Used micabo", "en")).toBe("Used the micabo app");
    expect(normaliserMarque("Usaste micabo", "es")).toBe("Usaste la app micabo");
    expect(normaliserMarque("nutze micabo", "de")).toBe("nutze die micabo-App");
  });

  it("ne double pas quand la slide dit déjà que c'est une appli", () => {
    expect(normaliserMarque("utilise une app comme micabo", "fr")).toBe(
      "utilise une app comme micabo",
    );
    expect(normaliserMarque("micabo gibi uygulamaları kullan", "tr")).toBe(
      "micabo gibi uygulamaları kullan",
    );
  });

  it("n'alourdit pas un titre de liste en anglais", () => {
    expect(normaliserMarque("4. MICABO (AI Tool)", "en")).toBe("4. micabo app (AI Tool)");
    expect(normaliserMarque("Try Micabo.", "en")).toBe("Try the micabo app.");
  });

  it("garde au moins la casse pour une langue sans forme connue", () => {
    expect(normaliserMarque("Micabo", "ja")).toBe("micabo");
  });

  it("laisse un texte sans marque intact", () => {
    expect(normaliserMarque("révise 10 minutes par jour", "fr")).toBe(
      "révise 10 minutes par jour",
    );
  });
});

describe("normaliserMarque — turc", () => {
  it("migre le suffixe de cas sur le possessif", () => {
    // C'est le cœur du piège : « micabo uygulaması'yu » n'existe pas.
    expect(normaliserMarque("notlarımı micabo'ya yüklüyorum", "tr")).toBe(
      "notlarımı micabo uygulamasına yüklüyorum",
    );
    expect(normaliserMarque("micabo'da kendini test et", "tr")).toBe(
      "micabo uygulamasında kendini test et",
    );
    expect(normaliserMarque("micabo'dan yardım al", "tr")).toBe(
      "micabo uygulamasından yardım al",
    );
  });

  it("met l'accusatif devant un « kullan- »", () => {
    expect(normaliserMarque("micabo kullandım", "tr")).toBe("micabo uygulamasını kullandım");
    expect(normaliserMarque("sen de micabo kullanmalısın", "tr")).toBe(
      "sen de micabo uygulamasını kullanmalısın",
    );
  });

  it("ne redouble pas le possessif quand le suffixe a déjà été traité", () => {
    // Sans le garde `(?!\s*uygulama)`, la règle de l'accusatif remord sur la
    // sortie de la règle du suffixe : « uygulamasını uygulamasını ».
    const out = normaliserMarque("(micabo'yu kullan)", "tr");
    expect(out).toBe("(micabo uygulamasını kullan)");
    expect(out).not.toMatch(/uygulama\S*\s+uygulama/);
  });

  it("gère l'apostrophe courbe comme la droite", () => {
    expect(normaliserMarque("micabo’yu dene", "tr")).toBe("micabo uygulamasını dene");
  });

  it("accole le possessif nu devant une postposition", () => {
    expect(normaliserMarque("notlarını micabo ile dönüştür", "tr")).toBe(
      "notlarını micabo uygulaması ile dönüştür",
    );
  });

  it("est idempotente", () => {
    const une = normaliserMarque("micabo'yu kullan", "tr");
    expect(normaliserMarque(une, "tr")).toBe(une);
  });
});

describe("retirerTiretsLongs", () => {
  it("remplace une incise par une virgule", () => {
    expect(retirerTiretsLongs("thinking tools — like coding for your brain")).toBe(
      "thinking tools, like coding for your brain",
    );
    expect(retirerTiretsLongs("tartış – online bile olabilir")).toBe(
      "tartış, online bile olabilir",
    );
  });

  it("garde un intervalle chiffré en trait d'union", () => {
    // « dormir 3–4h » est un intervalle, pas une incise.
    expect(retirerTiretsLongs("dormir 3–4h par nuit")).toBe("dormir 3-4h par nuit");
  });

  it("ne touche pas aux autres signes", () => {
    expect(retirerTiretsLongs("→ résume tout")).toBe("→ résume tout");
    expect(retirerTiretsLongs("- premier point")).toBe("- premier point");
  });

  it("est idempotente", () => {
    const une = retirerTiretsLongs("a — b — c");
    expect(retirerTiretsLongs(une)).toBe(une);
  });
});

describe("nettoyerTexteDeck", () => {
  it("applique les deux passes sur un deck source", () => {
    expect(nettoyerTexteDeck("Use Micabo — it builds flashcards", "en")).toBe(
      "Use the micabo app, it builds flashcards",
    );
  });

  it("est idempotente", () => {
    const une = nettoyerTexteDeck("Try Micabo — now", "en");
    expect(nettoyerTexteDeck(une, "en")).toBe(une);
  });
});
