import { describe, expect, it } from "vitest";

import { verifierLienPublication } from "./lienPublication";

describe("verifierLienPublication", () => {
  it("accepte un lien de post photo ou vidéo", () => {
    for (const l of [
      "https://www.tiktok.com/@hugo.notes813/photo/7412345678901234567",
      "https://www.tiktok.com/@hugo.notes813/video/7412345678901234567",
      "www.tiktok.com/@h/photo/7412345678901234567",
    ]) {
      expect(verifierLienPublication(l).ok).toBe(true);
    }
  });

  it("accepte un lien court de partage — l'id arrive à la redirection", () => {
    expect(verifierLienPublication("https://vt.tiktok.com/ZSqMCJwgD/").ok).toBe(true);
    expect(verifierLienPublication("https://vm.tiktok.com/ZN8jCFnNw/").ok).toBe(true);
  });

  // Les quatre cas réellement trouvés en prod le 14/09/2026.
  it("refuse la légende collée à la place du lien", () => {
    const v = verifierLienPublication("#methodetude #revisions #etudiant");
    expect(v.ok).toBe(false);
    expect(v.motif).toBe("pas_une_url");
  });

  it("refuse le lien du profil du créateur", () => {
    const v = verifierLienPublication(
      "https://www.tiktok.com/@ines.notes510?_r=1&_t=ZG-99eS8hXd32X",
    );
    expect(v.ok).toBe(false);
    expect(v.motif).toBe("profil_sans_post");
  });

  it("refuse le profil de quelqu'un d'autre", () => {
    expect(verifierLienPublication("https://www.tiktok.com/@gyael88").motif).toBe(
      "profil_sans_post",
    );
  });

  it("refuse un lien court sans identifiant", () => {
    expect(verifierLienPublication("https://vt.tiktok.com/").motif).toBe(
      "profil_sans_post",
    );
  });

  it("refuse le vide et un autre réseau", () => {
    expect(verifierLienPublication("   ").motif).toBe("vide");
    expect(verifierLienPublication("https://instagram.com/p/abc").motif).toBe("pas_tiktok");
  });

  it("tolère les espaces autour", () => {
    expect(
      verifierLienPublication("  https://www.tiktok.com/@h/photo/741234567890123 ").ok,
    ).toBe(true);
  });
});
