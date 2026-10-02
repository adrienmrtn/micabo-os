import { describe, expect, it } from "vitest";

import {
  MAX_FICHIERS_PARTAGE,
  MAX_OCTETS_PARTAGE,
  decouperEnLots,
  extensionVisuel,
  nomVisuel,
  tientEnUnLot,
} from "./partageLots";

const Mo = 1024 * 1024;

function fichiers(nb: number, taille: number) {
  return Array.from({ length: nb }, (_, i) => ({ nom: `s${i + 1}`, size: taille }));
}

describe("plafonds de navigator.share", () => {
  // Ce ne sont PAS des réglages : ce sont les constantes de Chromium
  // (kMaxSharedFileCount / kMaxSharedFileBytes). Les relever pour faire passer
  // un test ferait revenir exactement le « Permission denied » qu'on ferme.
  it("recopie les constantes Chromium et pas des valeurs choisies", () => {
    expect(MAX_FICHIERS_PARTAGE).toBe(10);
    expect(MAX_OCTETS_PARTAGE).toBe(50 * 1024 * 1024);
  });

  it("accepte exactement 10 fichiers et refuse le onzième", () => {
    expect(tientEnUnLot(fichiers(10, 1 * Mo))).toBe(true);
    expect(tientEnUnLot(fichiers(11, 1 * Mo))).toBe(false);
  });

  it("accepte exactement 50 Mio et refuse l'octet suivant", () => {
    expect(tientEnUnLot([{ size: MAX_OCTETS_PARTAGE }])).toBe(true);
    expect(tientEnUnLot([{ size: MAX_OCTETS_PARTAGE + 1 }])).toBe(false);
  });
});

describe("decouperEnLots", () => {
  // L'assertion qui compte : rien ne doit disparaître en route. Un post publié
  // avec une slide en moins est pire qu'un échec visible.
  it("rend exactement l'entrée une fois les lots remis bout à bout", () => {
    const entree = fichiers(12, 1 * Mo);
    const lots = decouperEnLots(entree);
    expect(lots.flat()).toEqual(entree);
  });

  it("coupe les 12 photos de Vojtěch en 10 + 2", () => {
    const lots = decouperEnLots(fichiers(12, 1 * Mo));
    expect(lots.map((l) => l.length)).toEqual([10, 2]);
  });

  it("coupe sur le poids quand le nombre passerait : 6 photos de 9 Mo", () => {
    // La forme de Gencay : 6 fichiers, donc sous le plafond de 10, mais 54 Mo.
    const lots = decouperEnLots(fichiers(6, 9 * Mo));
    expect(lots.length).toBeGreaterThan(1);
    for (const lot of lots) {
      expect(tientEnUnLot(lot)).toBe(true);
    }
  });

  it("laisse un seul lot quand tout tient", () => {
    expect(decouperEnLots(fichiers(6, 1 * Mo))).toHaveLength(1);
  });

  it("garde un fichier hors plafond dans son propre lot plutôt que de le perdre", () => {
    const enorme = { nom: "lourde", size: 60 * Mo };
    const lots = decouperEnLots([{ nom: "a", size: 1 * Mo }, enorme, { nom: "b", size: 1 * Mo }]);
    expect(lots.flat()).toContain(enorme);
    expect(lots.flat()).toHaveLength(3);
  });

  it("rend une liste vide sans lot vide", () => {
    expect(decouperEnLots([])).toEqual([]);
  });
});

describe("nomVisuel", () => {
  const post = "b1bc3cb3-0000-0000-0000-000000000000";

  it("distingue deux visuels que la position confondait", () => {
    // Avant : nomFichier(post, slide.position) — deux slides à la position 5
    // (0279) donnaient deux fois le même nom, et zip.file() écrasait.
    const a = nomVisuel(post, 5, "https://x/storage/v1/object/public/m/propre/5.jpg");
    const b = nomVisuel(post, 6, "https://x/storage/v1/object/public/m/propre/5.jpg");
    expect(a).not.toBe(b);
  });

  it("garde l'extension réelle du fichier stocké", () => {
    expect(nomVisuel(post, 1, "https://x/m/propre/1.png")).toMatch(/\.png$/);
    expect(nomVisuel(post, 1, "https://x/m/propre/1.jpg?v=2")).toMatch(/\.jpg$/);
  });

  it("retombe sur jpg pour une extension inconnue ou absente", () => {
    expect(extensionVisuel("https://x/m/propre/1")).toBe("jpg");
    expect(extensionVisuel("https://x/m/propre/1.heic")).toBe("jpg");
  });
});
