import { describe, expect, it } from "vitest";

import { compteEnProcess } from "./compteProcess";

const maintenant = Date.parse("2026-10-06T18:00:00Z");
const passe = "2026-10-06T10:00:00Z";
const futur = "2026-10-07T10:00:00Z";

describe("compteEnProcess", () => {
  it("sert un compte dont le warmup est fini", () => {
    expect(compteEnProcess({ warmup_ends_at: passe }, maintenant)).toBe(true);
  });

  it("ne sert pas un compte en warmup ou qui ne l'a pas démarré", () => {
    expect(compteEnProcess({ warmup_ends_at: futur }, maintenant)).toBe(false);
    expect(compteEnProcess({ warmup_ends_at: null }, maintenant)).toBe(false);
  });

  it("le mode test peut viser un compte hors process", () => {
    expect(compteEnProcess({ warmup_ends_at: null }, maintenant, true)).toBe(true);
  });

  it("ne sert JAMAIS un compte vidéo, warmup fini ou mode test", () => {
    expect(compteEnProcess({ warmup_ends_at: passe, ugc_ai_video: true }, maintenant)).toBe(false);
    expect(compteEnProcess({ warmup_ends_at: null, ugc_ai_video: true }, maintenant, true)).toBe(false);
  });

  it("un compte classique (ugc_ai_video faux ou absent) suit la règle du warmup", () => {
    expect(compteEnProcess({ warmup_ends_at: passe, ugc_ai_video: false }, maintenant)).toBe(true);
  });
});
