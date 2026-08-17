import { describe, expect, it } from "vitest";

import {
  MARGE_UPDATE_SEC,
  estNouveauDepuisImport,
  filtrerNouveauxDepuisImport,
  idPostTiktok,
  maxIdTiktok,
  normaliserCreateTime,
} from "./importNouveaux";

const ANCIEN = "https://www.tiktok.com/@src/photo/7000000000000000000";
const MILIEU = "https://www.tiktok.com/@src/photo/7500000000000000000";
const RECENT = "https://www.tiktok.com/@src/video/7990000000000000000";

describe("idPostTiktok / maxIdTiktok / createTime", () => {
  it("extrait l’id photo ou vidéo", () => {
    expect(idPostTiktok(ANCIEN)).toBe("7000000000000000000");
    expect(idPostTiktok(RECENT)).toBe("7990000000000000000");
    expect(idPostTiktok("https://www.tiktok.com/@src")).toBe("https://www.tiktok.com/@src");
  });

  it("normalise ms → secondes", () => {
    expect(normaliserCreateTime(1_700_000_000)).toBe(1_700_000_000);
    expect(normaliserCreateTime(1_700_000_000_000)).toBe(1_700_000_000);
    expect(normaliserCreateTime(0)).toBeNull();
    expect(normaliserCreateTime(null)).toBeNull();
  });

  it("prend le plus grand id numérique", () => {
    expect(maxIdTiktok(["12", "9", "abc"])).toBe(12n);
    expect(maxIdTiktok([])).toBeNull();
  });
});

describe("estNouveauDepuisImport", () => {
  const dernier = new Date("2026-08-01T12:00:00Z");
  const connus = new Set(["7000000000000000000", "7500000000000000000"]);

  it("écarte un TikTok déjà importé", () => {
    expect(
      estNouveauDepuisImport({
        url: ANCIEN,
        createTime: 1_800_000_000,
        connusIds: connus,
        dernierImportAt: dernier,
        maxIdConnu: maxIdTiktok(connus),
      }),
    ).toBe(false);
  });

  it("garde tout si aucun import précédent", () => {
    expect(
      estNouveauDepuisImport({
        url: ANCIEN,
        createTime: 1,
        connusIds: new Set(),
        dernierImportAt: null,
        maxIdConnu: null,
      }),
    ).toBe(true);
  });

  it("garde un post daté après le dernier scrape (avec marge)", () => {
    const apres = Math.floor(dernier.getTime() / 1000) + 60;
    expect(
      estNouveauDepuisImport({
        url: RECENT,
        createTime: apres,
        connusIds: connus,
        dernierImportAt: dernier,
        maxIdConnu: maxIdTiktok(connus),
      }),
    ).toBe(true);
  });

  it("écarte un post daté clairement avant le dernier scrape", () => {
    const tropVieux = Math.floor(dernier.getTime() / 1000) - MARGE_UPDATE_SEC - 10;
    expect(
      estNouveauDepuisImport({
        url: RECENT,
        createTime: tropVieux,
        connusIds: connus,
        dernierImportAt: dernier,
        maxIdConnu: maxIdTiktok(connus),
      }),
    ).toBe(false);
  });

  it("sans date : garde seulement un id plus récent que le stock", () => {
    expect(
      estNouveauDepuisImport({
        url: RECENT,
        createTime: null,
        connusIds: connus,
        dernierImportAt: dernier,
        maxIdConnu: maxIdTiktok(connus),
      }),
    ).toBe(true);
    expect(
      estNouveauDepuisImport({
        url: MILIEU,
        createTime: null,
        connusIds: connus,
        dernierImportAt: dernier,
        maxIdConnu: maxIdTiktok(connus),
      }),
    ).toBe(false);
  });
});

describe("filtrerNouveauxDepuisImport", () => {
  it("ne remonte que les inédits postérieurs au dernier import", () => {
    const dernier = new Date("2026-08-10T00:00:00Z");
    const t = Math.floor(dernier.getTime() / 1000);
    const out = filtrerNouveauxDepuisImport(
      [
        { url: ANCIEN, createTime: t - 10_000 },
        { url: MILIEU, createTime: t + 10 },
        { url: RECENT, createTime: t + 100 },
      ],
      new Set(["7500000000000000000"]),
      dernier,
    );
    expect(out.map((c) => c.url)).toEqual([RECENT]);
  });
});
