import { describe, expect, it } from "vitest";

import { assurerCtaSiteTurc } from "./ctaSiteTr";

describe("assurerCtaSiteTurc", () => {
  it("laisse un CTA qui dit déjà sitesiyle / sitesini", () => {
    expect(assurerCtaSiteTurc("notlarını micabo.app sitesiyle bilgi kartlarına dönüştür")).toBe(
      "notlarını micabo.app sitesiyle bilgi kartlarına dönüştür",
    );
    expect(
      assurerCtaSiteTurc("micabo.app gibi bir siteyle eski konuları tekrar çalışabilirsin."),
    ).toContain("siteyle");
  });

  it("corrige « site micabo.app » et « micabo.app ile » sans site", () => {
    expect(assurerCtaSiteTurc("site micabo.app ile kendini test et")).toBe(
      "micabo.app sitesiyle kendini test et",
    );
    expect(
      assurerCtaSiteTurc("test et kendini. site micabo.app notlarını anında testlere çevirir."),
    ).toBe("test et kendini. micabo.app sitesi notlarını anında testlere çevirir.");
    expect(
      assurerCtaSiteTurc("notlarını tekrar okumayı bırak\nmicabo.app ile kendini test et ve aklında tut"),
    ).toBe("notlarını tekrar okumayı bırak\nmicabo.app sitesiyle kendini test et ve aklında tut");
    expect(assurerCtaSiteTurc("micabo.app'i kullan, flashcard'lar oluştur.")).toBe(
      "micabo.app sitesini kullan, flashcard'lar oluştur.",
    );
  });
});
