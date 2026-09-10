import { describe, expect, it } from "vitest";

import {
  memeFormat,
  ratioDominant,
  ratioVisuel,
  recadrageCible,
  urlVisuelRecadre,
} from "../../../supabase/functions/_shared/format_visuel.ts";

/** Cas réel mesuré en prod : @studylapses/7557750110390635798 après nettoyage. */
const SLIDESHOW_STUDYLAPSES = [
  { largeur: 2048, hauteur: 2048 }, // hook, source 1080×1084
  { largeur: 1760, hauteur: 2368 },
  { largeur: 1760, hauteur: 2368 },
  { largeur: 1760, hauteur: 2368 },
  { largeur: 1760, hauteur: 2368 },
  { largeur: 1760, hauteur: 2368 },
  { largeur: 1760, hauteur: 2368 },
];

describe("ratioDominant", () => {
  it("aligne le hook carré sur les six slides 3:4", () => {
    const ratio = ratioDominant(SLIDESHOW_STUDYLAPSES);
    expect(ratio).toBeCloseTo(1760 / 2368, 6);
  });

  it("renvoie toujours le ratio d'une slide existante", () => {
    const ratio = ratioDominant(SLIDESHOW_STUDYLAPSES);
    expect(
      SLIDESHOW_STUDYLAPSES.some((d) => ratioVisuel(d) === ratio),
    ).toBe(true);
  });

  it("post assemblé depuis trois TikToks : la majorité l'emporte", () => {
    // Post a075f60d : un carré, un 2:3, quatre 3:4.
    const ratio = ratioDominant([
      { largeur: 2048, hauteur: 2048 },
      { largeur: 1664, hauteur: 2496 },
      { largeur: 1760, hauteur: 2368 },
      { largeur: 1760, hauteur: 2368 },
      { largeur: 1760, hauteur: 2368 },
      { largeur: 1760, hauteur: 2368 },
    ]);
    expect(ratio).toBeCloseTo(1760 / 2368, 6);
  });

  it("tolère la dérive des paliers du text-removal (0.743 vs 0.75)", () => {
    // 880×1184 et 1080×1440 sont le même format à 1 % près : un seul groupe.
    const ratio = ratioDominant([
      { largeur: 880, hauteur: 1184 },
      { largeur: 1080, hauteur: 1440 },
      { largeur: 2048, hauteur: 2048 },
    ]);
    expect(memeFormat(ratio!, 0.75)).toBe(true);
  });

  it("sans groupe majoritaire, choisit le ratio qui rogne le moins", () => {
    // 1:1 est entre les deux : il conserve plus de pixels que les extrêmes.
    const ratio = ratioDominant([
      { largeur: 900, hauteur: 1600 },
      { largeur: 1000, hauteur: 1000 },
      { largeur: 1600, hauteur: 900 },
    ]);
    expect(ratio).toBe(1);
  });

  it("égalité parfaite : le hook garde son cadrage", () => {
    // Cas réel (contenu da46ccdd) : deux slides 0.5402, deux slides 0.7432.
    // Groupes et pixels rognés sont symétriques — c'est la 1ʳᵉ slide qui tranche.
    const slides = [
      { largeur: 1504, hauteur: 2784 },
      { largeur: 1760, hauteur: 2368 },
      { largeur: 1760, hauteur: 2368 },
      { largeur: 1504, hauteur: 2784 },
    ];
    expect(ratioDominant(slides)).toBeCloseTo(1504 / 2784, 6);
    // Même diaporama, hook 3:4 : c'est l'autre format qui l'emporte.
    expect(
      ratioDominant([
        { largeur: 1760, hauteur: 2368 },
        { largeur: 1504, hauteur: 2784 },
        { largeur: 1504, hauteur: 2784 },
        { largeur: 1760, hauteur: 2368 },
      ]),
    ).toBeCloseTo(1760 / 2368, 6);
  });

  it("ignore les dimensions illisibles et rend null si tout manque", () => {
    expect(ratioDominant([])).toBeNull();
    expect(ratioDominant([{ largeur: 0, hauteur: 0 }])).toBeNull();
    expect(
      ratioDominant([{ largeur: 0, hauteur: 0 }, { largeur: 1080, hauteur: 1440 }]),
    ).toBeCloseTo(0.75, 6);
  });
});

describe("recadrageCible", () => {
  const ratio = 1760 / 2368;

  it("laisse tranquille une slide déjà au bon format", () => {
    expect(recadrageCible({ largeur: 1760, hauteur: 2368 }, ratio)).toBeNull();
  });

  it("recadre le hook carré en gardant toute sa hauteur", () => {
    const cible = recadrageCible({ largeur: 2048, hauteur: 2048 }, ratio);
    expect(cible).toEqual({ largeur: 1522, hauteur: 2048 });
  });

  it("n'agrandit jamais au-delà de la source", () => {
    for (const source of SLIDESHOW_STUDYLAPSES) {
      const cible = recadrageCible(source, ratio);
      if (!cible) continue;
      expect(cible.largeur).toBeLessThanOrEqual(source.largeur);
      expect(cible.hauteur).toBeLessThanOrEqual(source.hauteur);
    }
  });

  it("rogne le haut et le bas quand la cible est plus large", () => {
    const cible = recadrageCible({ largeur: 1080, hauteur: 1920 }, 0.75);
    expect(cible).toEqual({ largeur: 1080, hauteur: 1440 });
  });

  it("le recadrage produit bien le ratio demandé", () => {
    const cible = recadrageCible({ largeur: 2048, hauteur: 2048 }, ratio)!;
    expect(memeFormat(ratioVisuel(cible), ratio)).toBe(true);
  });

  it("refuse une source ou un ratio inexploitable", () => {
    expect(recadrageCible({ largeur: 0, hauteur: 100 }, 0.75)).toBeNull();
    expect(recadrageCible({ largeur: 100, hauteur: 100 }, 0)).toBeNull();
  });
});

describe("urlVisuelRecadre", () => {
  const objet =
    "https://qkmiwnmiwsvwkttldqgb.supabase.co/storage/v1/object/public/medias/propre/abc/1.jpg?v=42";

  it("bascule sur l'endpoint de rendu avec un cover centré", () => {
    const url = new URL(
      urlVisuelRecadre(objet, { largeur: 1522, hauteur: 2048 })!,
    );
    expect(url.pathname).toBe(
      "/storage/v1/render/image/public/medias/propre/abc/1.jpg",
    );
    expect(url.searchParams.get("width")).toBe("1522");
    expect(url.searchParams.get("height")).toBe("2048");
    expect(url.searchParams.get("resize")).toBe("cover");
    expect(url.searchParams.get("quality")).toBe("95");
    // `origin` garde l'extension du fichier stocké.
    expect(url.searchParams.get("format")).toBe("origin");
  });

  it("conserve le cache-buster de la ligne media_library", () => {
    const url = new URL(
      urlVisuelRecadre(objet, { largeur: 1522, hauteur: 2048 })!,
    );
    expect(url.searchParams.get("v")).toBe("42");
  });

  it("rend null hors Storage public — on servira l'original", () => {
    expect(
      urlVisuelRecadre("https://p16-sign.tiktokcdn.com/x.jpeg", {
        largeur: 10,
        hauteur: 10,
      }),
    ).toBeNull();
    expect(urlVisuelRecadre("pas-une-url", { largeur: 10, hauteur: 10 })).toBeNull();
  });
});
