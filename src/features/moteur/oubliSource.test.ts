import { describe, expect, it } from "vitest";

import {
  compteursVides,
  cumulerCompteurs,
  decouperEnLots,
  handleDeLUrl,
  handleTiktokDepuisSaisie,
  idPostTiktokStrict,
  normaliserHandle,
  prefixeStorageScrape,
  prefixeStorageSujet,
  prefixesStorageContenu,
  resumeCompteurs,
  urlDuHandle,
} from "./oubliSource";

describe("normaliserHandle", () => {
  it("retire le @, les espaces et la casse", () => {
    expect(normaliserHandle("@Sophia_Studio ")).toBe("sophia_studio");
    expect(normaliserHandle("  @@double")).toBe("double");
    expect(normaliserHandle(null)).toBe("");
  });
});

describe("handleDeLUrl", () => {
  it("lit le handle d’une URL TikTok", () => {
    expect(handleDeLUrl("https://www.tiktok.com/@sophia/photo/7123")).toBe("sophia");
    expect(handleDeLUrl("https://tiktok.com/@Sophia.Studio/video/7123?x=1")).toBe(
      "sophia.studio",
    );
  });

  it("extrait le handle d’une saisie URL ou @handle", () => {
    expect(handleTiktokDepuisSaisie("https://www.tiktok.com/@katsreset")).toBe("katsreset");
    expect(handleTiktokDepuisSaisie("@katsreset")).toBe("katsreset");
    expect(handleTiktokDepuisSaisie("katsreset")).toBe("katsreset");
  });

  it("renvoie null hors TikTok", () => {
    expect(handleDeLUrl("https://example.com/@sophia")).toBeNull();
    expect(handleDeLUrl("")).toBeNull();
    expect(handleDeLUrl(null)).toBeNull();
  });
});

describe("urlDuHandle", () => {
  const url = "https://www.tiktok.com/@sophia/photo/7123456789";

  it("reconnaît le compte quelle que soit l’écriture du handle", () => {
    expect(urlDuHandle(url, "sophia")).toBe(true);
    expect(urlDuHandle(url, "@Sophia")).toBe(true);
  });

  it("n’emporte PAS les slideshows d’un compte au nom voisin", () => {
    // Le pré-filtre SQL `ilike %@sophia%` ramène ces URLs : le tri exact évite
    // de supprimer le contenu d’un autre compte.
    expect(urlDuHandle("https://www.tiktok.com/@sophia_officiel/photo/1", "sophia")).toBe(
      false,
    );
    expect(urlDuHandle("https://www.tiktok.com/@notsophia/photo/1", "sophia")).toBe(false);
    expect(urlDuHandle(url, "sophi")).toBe(false);
  });

  it("refuse un handle vide plutôt que de tout matcher", () => {
    expect(urlDuHandle(url, "")).toBe(false);
    expect(urlDuHandle(url, "@")).toBe(false);
  });

  it("gère une URL absente", () => {
    expect(urlDuHandle(null, "sophia")).toBe(false);
  });
});

describe("chemins storage", () => {
  it("cible les deux dossiers d’un slideshow", () => {
    expect(prefixesStorageContenu("abc")).toEqual(["propre/abc", "brut/abc"]);
  });

  it("cible le dossier écrit au scrape, avant la ligne contenu", () => {
    expect(prefixeStorageScrape("https://www.tiktok.com/@s/photo/7123")).toBe("brut/7123");
    expect(prefixeStorageScrape("https://www.tiktok.com/@s/video/7124")).toBe("brut/7124");
    expect(prefixeStorageScrape("https://www.tiktok.com/@s")).toBeNull();
    expect(prefixeStorageScrape(null)).toBeNull();
  });

  it("cible le dossier d’un sujet legacy", () => {
    expect(prefixeStorageSujet("suj-1")).toBe("propre/suj-1");
  });

  it("extrait l’id du post sans jamais retomber sur l’URL entière", () => {
    expect(idPostTiktokStrict("https://www.tiktok.com/@s/photo/7123")).toBe("7123");
    expect(idPostTiktokStrict("https://www.tiktok.com/@s")).toBeNull();
  });
});

describe("resumeCompteurs", () => {
  it("écrit une ligne lisible, dans l’ordre, et ignore les zéros", () => {
    expect(resumeCompteurs({ contenus: 12, medias: 40, fichiers: 41, posts: 0 })).toBe(
      "12 slideshow(s) · 40 image(s) · 41 fichier(s)",
    );
    expect(resumeCompteurs(compteursVides())).toBe("rien");
  });
});

describe("compteurs", () => {
  it("cumule passage après passage", () => {
    let total = compteursVides();
    total = cumulerCompteurs(total, { contenus: 15, medias: 90, fichiers: 92 });
    total = cumulerCompteurs(total, { contenus: 4, posts: 3 });
    total = cumulerCompteurs(total, { sujets: 2, importFile: 19 });
    expect(total).toEqual({
      contenus: 19,
      medias: 90,
      fichiers: 92,
      posts: 3,
      sujets: 2,
      importFile: 19,
    });
  });
});

describe("decouperEnLots", () => {
  it("borne la taille des in(...) PostgREST", () => {
    expect(decouperEnLots([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("ne perd rien sur les tailles limites", () => {
    expect(decouperEnLots([], 10)).toEqual([]);
    expect(decouperEnLots([1, 2], 10)).toEqual([[1, 2]]);
    // Une taille absurde ne doit pas produire une boucle infinie.
    expect(decouperEnLots([1, 2, 3], 0)).toEqual([[1], [2], [3]]);
  });
});
