import { describe, expect, it } from "vitest";

import {
  DEMENAGEMENT_DEBUT,
  demenagementCommence,
  identifiantSophia,
  langueDemenagement,
  TEXTES_DEMENAGEMENT,
} from "./demenagement";

describe("identifiantSophia", () => {
  it("x@micabo.app → x@sophia.com, casse et espaces ignorés", () => {
    expect(identifiantSophia("karenr@micabo.app")).toBe("karenr@sophia.com");
    expect(identifiantSophia("  GencayE@Micabo.app ")).toBe("gencaye@sophia.com");
  });

  it("Eva reste sur micabo-os ; un autre domaine ou rien : pas de pop-up", () => {
    expect(identifiantSophia("eva@micabo.app")).toBeNull();
    expect(identifiantSophia("admin@example.com")).toBeNull();
    expect(identifiantSophia("x@micabo.app.evil.com")).toBeNull();
    expect(identifiantSophia("")).toBeNull();
    expect(identifiantSophia(null)).toBeNull();
    expect(identifiantSophia(undefined)).toBeNull();
  });
});

describe("demenagementCommence", () => {
  it("à partir du 12/10/2026 à 0 h, heure de Paris", () => {
    expect(demenagementCommence(Date.parse("2026-10-11T21:59:59Z"))).toBe(false);
    expect(demenagementCommence(DEMENAGEMENT_DEBUT)).toBe(true);
    expect(demenagementCommence(Date.parse("2026-10-12T08:00:00Z"))).toBe(true);
  });
});

describe("langueDemenagement", () => {
  it("la langue du créateur d'abord, puis celle de l'interface, sinon l'anglais", () => {
    expect(langueDemenagement(["tr"], "en")).toBe("tr");
    expect(langueDemenagement(["de", "fr"], "fr")).toBe("de");
    expect(langueDemenagement([], "fr-FR")).toBe("fr");
    expect(langueDemenagement(["pt"], "it")).toBe("en");
    expect(langueDemenagement(null, null)).toBe("en");
  });

  it("chaque langue a tous ses textes", () => {
    const cles = Object.keys(TEXTES_DEMENAGEMENT.fr).sort();
    for (const textes of Object.values(TEXTES_DEMENAGEMENT)) {
      expect(Object.keys(textes).sort()).toEqual(cles);
      expect(Object.values(textes).every((v) => v.trim().length > 0)).toBe(true);
    }
  });
});
