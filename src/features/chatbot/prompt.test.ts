import { describe, expect, it } from "vitest";

import {
  CONTEXTE_MAX,
  assemblerContexte,
  audiencesPour,
  htmlVersTexte,
} from "./prompt";

describe("htmlVersTexte", () => {
  it("retire les balises et garde le texte", () => {
    expect(htmlVersTexte("<p>Bonjour <strong>toi</strong></p>")).toBe("Bonjour toi");
  });

  it("transforme les listes en puces", () => {
    expect(htmlVersTexte("<ul><li>A</li><li>B</li></ul>")).toBe("• A\n• B");
  });

  it("décode les entités courantes", () => {
    expect(htmlVersTexte("A&nbsp;&amp;&nbsp;B")).toBe("A & B");
  });
});

describe("audiencesPour", () => {
  it("filtre les docs selon le rôle", () => {
    expect(audiencesPour("poster")).toEqual(["poster", "all"]);
    expect(audiencesPour("hiring_manager")).toEqual(["manager", "all"]);
    expect(audiencesPour("admin")).toEqual(["manager", "poster", "all"]);
  });
});

describe("assemblerContexte", () => {
  const docs = [
    {
      titre: "Guide créateur",
      titre_en: "Creator guide",
      contenu: "<p>Poste le carrousel</p>",
      contenu_en: "<p>Post the carousel</p>",
      audience: "poster" as const,
    },
    {
      titre: "Guide manager",
      titre_en: null,
      contenu: "<p>Recrute un poster</p>",
      contenu_en: null,
      audience: "manager" as const,
    },
  ];

  it("n'injecte pas le guide manager à un créateur", () => {
    const texte = assemblerContexte([], docs, "poster", "fr");
    expect(texte).toContain("Guide créateur");
    expect(texte).toContain("Poste le carrousel");
    expect(texte).not.toContain("Guide manager");
  });

  it("prend la version anglaise si demandée", () => {
    const texte = assemblerContexte([], docs, "poster", "en");
    expect(texte).toContain("Creator guide");
    expect(texte).toContain("Post the carousel");
  });

  it("ajoute les snippets admin en tête", () => {
    const texte = assemblerContexte(
      [{ titre: "Mot de passe", contenu: "Le mot de passe commun est dicté à l'oral." }],
      docs,
      "hiring_manager",
      "fr",
    );
    expect(texte.startsWith("### Mot de passe")).toBe(true);
    expect(texte).toContain("Guide manager");
    expect(texte).not.toContain("Guide créateur");
  });

  it("tronque un contexte trop long", () => {
    const gros = "x".repeat(CONTEXTE_MAX + 80);
    const texte = assemblerContexte([{ titre: "Gros", contenu: gros }], [], "admin", "fr");
    expect(texte.length).toBeLessThan(gros.length);
    expect(texte.endsWith("[…contexte tronqué]")).toBe(true);
  });
});
