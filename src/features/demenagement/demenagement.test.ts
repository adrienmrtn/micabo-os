import { describe, expect, it } from "vitest";

import {
  COPIE_LOGINS,
  DEMENAGEMENT_DEBUT,
  demenagementCommence,
  identifiantADonner,
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

describe("identifiantADonner", () => {
  const base = {
    role: "poster",
    email: "omerc@micabo.app",
    creeLe: "2026-09-06T06:10:00Z",
    maintenant: Date.parse("2026-10-12T08:00:00Z"),
  };

  it("un créateur copié, à partir du 12/10 : son identifiant Sophia", () => {
    expect(identifiantADonner(base)).toBe("omerc@sophia.com");
  });

  it("ni l'admin qui relit un post, ni un manager", () => {
    expect(identifiantADonner({ ...base, role: "admin", email: "ad@micabo.app" })).toBeNull();
    expect(identifiantADonner({ ...base, role: "hiring_manager" })).toBeNull();
    expect(identifiantADonner({ ...base, role: null })).toBeNull();
  });

  it("pas avant le 12/10, pas un login créé après la copie, pas sans date de création", () => {
    expect(identifiantADonner({ ...base, maintenant: Date.parse("2026-10-11T12:00:00Z") })).toBeNull();
    expect(identifiantADonner({ ...base, creeLe: new Date(COPIE_LOGINS).toISOString() })).toBeNull();
    expect(identifiantADonner({ ...base, creeLe: "2026-10-10T09:00:00Z" })).toBeNull();
    expect(identifiantADonner({ ...base, creeLe: null })).toBeNull();
    expect(identifiantADonner({ ...base, creeLe: "pas une date" })).toBeNull();
  });

  it("Eva reste sur micabo-os", () => {
    expect(identifiantADonner({ ...base, email: "eva@micabo.app" })).toBeNull();
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
  it("la langue ajoutée au « fr » par défaut des profils l'emporte", () => {
    expect(langueDemenagement(["fr", "tr"], "en")).toBe("tr");
    expect(langueDemenagement(["fr", "de"], "de-DE")).toBe("de");
    expect(langueDemenagement(["fr", "es"], "fr")).toBe("es");
    expect(langueDemenagement(["fr", "en"], "fr")).toBe("en");
    expect(langueDemenagement(["fr"], "en")).toBe("fr");
  });

  it("sinon la langue de l'interface, sinon l'anglais", () => {
    expect(langueDemenagement([], "fr-FR")).toBe("fr");
    expect(langueDemenagement(["pt"], "it")).toBe("en");
    expect(langueDemenagement(["pt"], "de")).toBe("de");
    expect(langueDemenagement(null, null)).toBe("en");
  });

  it("une langue sans texte (it, pt…) : l'interface si ce n'est pas le « fr » par défaut, sinon l'anglais", () => {
    expect(langueDemenagement(["fr", "it"], "en")).toBe("en");
    expect(langueDemenagement(["fr", "pt"], "fr")).toBe("en");
    expect(langueDemenagement(["fr", "pt"], "de")).toBe("de");
    expect(langueDemenagement(["fr", "nl"], null)).toBe("en");
  });

  it("chaque langue a tous ses textes", () => {
    const cles = Object.keys(TEXTES_DEMENAGEMENT.fr).sort();
    for (const textes of Object.values(TEXTES_DEMENAGEMENT)) {
      expect(Object.keys(textes).sort()).toEqual(cles);
      expect(Object.values(textes).every((v) => v.trim().length > 0)).toBe(true);
    }
  });
});
