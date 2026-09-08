import { describe, expect, it } from "vitest";

import { langueDepuisTexte } from "./langue";

describe("langueDepuisTexte", () => {
  it("lit le pays dans le titre ou la description", () => {
    expect(langueDepuisTexte("TikTok Slayt İçeriği Oluşturucusu (Türkiye)")).toBe("tr");
    expect(langueDepuisTexte("TikTok Slideshow Creator (Based in France)")).toBe("fr");
    expect(langueDepuisTexte("Hiring Manager", "posters in Spain")).toBe("es");
    expect(langueDepuisTexte("Hiring Manager", "posters in Turkey")).toBe("tr");
    expect(langueDepuisTexte("Hiring Manager", "posters in Germany")).toBe("de");
    expect(langueDepuisTexte("Responsable du recrutement", "designated countries")).toBe("fr");
  });

  it("ne devine pas un titre vide", () => {
    expect(langueDepuisTexte("Hiring Manager", "help us promote Micabo.app")).toBeNull();
  });
});
