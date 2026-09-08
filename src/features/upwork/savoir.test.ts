import { describe, expect, it } from "vitest";

import {
  appliquerConsigne,
  extraireEntrees,
  htmlVersTexte,
  reponseDepuisDocuments,
} from "./savoir";

const docHm = {
  cle: "reponses_upwork",
  titre: "Réponses Upwork",
  contenu:
    "<h2>Comment on démarre ?</h2><p>On envoie le contrat Upwork. Tu acceptes, ensuite Slack et l'OS.</p><h2>Faut-il un appel ?</h2><p>Non. On fait tout sur le fil Upwork.</p>",
  contenu_en:
    "<h2>How do we get started?</h2><p>We send the Upwork contract. You accept, then Slack and the OS.</p><h2>Do we need a call?</h2><p>No. We do everything on the Upwork thread.</p>",
};

describe("htmlVersTexte / extraireEntrees", () => {
  it("coupe les titres et garde le corps", () => {
    const entrees = extraireEntrees(docHm.contenu);
    expect(entrees).toEqual([
      {
        titre: "Comment on démarre ?",
        corps: "On envoie le contrat Upwork. Tu acceptes, ensuite Slack et l'OS.",
      },
      {
        titre: "Faut-il un appel ?",
        corps: "Non. On fait tout sur le fil Upwork.",
      },
    ]);
    expect(htmlVersTexte("<p>Hi&nbsp;there</p>")).toBe("Hi there");
  });
});

describe("reponseDepuisDocuments", () => {
  it("prend le passage EN qui répond à leur question", () => {
    expect(
      reponseDepuisDocuments("How do we get started? Thanks.", [docHm], "es"),
    ).toContain("We send the Upwork contract");
    expect(
      reponseDepuisDocuments("Let me know when to get on a call.", [docHm], "tr"),
    ).toContain("on the Upwork thread");
  });

  it("prend le passage FR pour la France", () => {
    expect(reponseDepuisDocuments("Comment on démarre ?", [docHm], "fr")).toContain(
      "contrat Upwork",
    );
  });

  it("ne invente rien si aucun document ne colle", () => {
    expect(reponseDepuisDocuments("What is your favorite color?", [docHm], "es")).toBeNull();
    expect(reponseDepuisDocuments("How do we get started?", [], "es")).toBeNull();
  });
});

describe("appliquerConsigne", () => {
  it("retire les cadratins et ajoute un smiley si demandé", () => {
    const brut = "Hi Sofia,\n\nUnderstood — next step.";
    expect(appliquerConsigne(brut, "Pas de tirets cadratins.")).toBe(
      "Hi Sofia,\n\nUnderstood - next step.",
    );
    expect(appliquerConsigne(brut, "Ajoute des smileys. Pas de tirets cadratins.")).toContain(
      "🙂",
    );
    expect(appliquerConsigne("Hi Sofia, 🙂\n\nOk.", "Pas de smiley")).not.toContain("🙂");
  });
});
