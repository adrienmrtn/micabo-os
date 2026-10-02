import { afterEach, describe, expect, it, vi } from "vitest";

import { partagerFichiers, peutPartager, recupererVisuelsUniformises } from "./telechargement";
import { MAX_OCTETS_PARTAGE } from "./partageLots";

const Mo = 1024 * 1024;

/** Un `File` dont seule la taille compte ici — on ne lit jamais les octets. */
function faux(nom: string, taille: number): File {
  return { name: nom, size: taille, type: "image/jpeg" } as File;
}

function navigateurQuiAccepteTout(share = vi.fn().mockResolvedValue(undefined)) {
  vi.stubGlobal("navigator", { canShare: () => true, share });
  return share;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("peutPartager", () => {
  // LE test de cette correction. Chromium répond `true` à `canShare` pour une
  // charge que `share()` refusera ensuite par « Permission denied » : c'est ce
  // que trois créateurs ont vu brut à l'écran entre le 29/09 et le 02/10.
  it("refuse 12 fichiers même quand canShare dit oui", () => {
    navigateurQuiAccepteTout();
    const douze = Array.from({ length: 12 }, (_, i) => faux(`s${i}.jpg`, 1 * Mo));
    expect(peutPartager(douze)).toBe(false);
  });

  it("refuse 6 fichiers trop lourds même quand canShare dit oui", () => {
    navigateurQuiAccepteTout();
    const six = Array.from({ length: 6 }, (_, i) => faux(`s${i}.jpg`, 9 * Mo));
    expect(peutPartager(six)).toBe(false);
  });

  it("accepte un lot qui tient dans les deux plafonds", () => {
    navigateurQuiAccepteTout();
    expect(peutPartager([faux("a.jpg", 1 * Mo), faux("b.jpg", 1 * Mo)])).toBe(true);
    expect(peutPartager([faux("a.jpg", MAX_OCTETS_PARTAGE)])).toBe(true);
  });

  it("refuse une liste vide et un navigateur sans partage", () => {
    navigateurQuiAccepteTout();
    expect(peutPartager([])).toBe(false);
    vi.stubGlobal("navigator", {});
    expect(peutPartager([faux("a.jpg", 1 * Mo)])).toBe(false);
  });
});

describe("partagerFichiers", () => {
  it("rend false sur un abandon et relance tout le reste", async () => {
    const abandon = new DOMException("closed", "AbortError");
    navigateurQuiAccepteTout(vi.fn().mockRejectedValue(abandon));
    await expect(partagerFichiers([faux("a.jpg", 1)], "t")).resolves.toBe(false);

    // Le refus de charge de Chromium : il doit remonter, pas être avalé —
    // c'est l'appelant qui décide du repli ZIP.
    const refus = new DOMException("Permission denied", "NotAllowedError");
    navigateurQuiAccepteTout(vi.fn().mockRejectedValue(refus));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(partagerFichiers([faux("a.jpg", 1)], "t")).rejects.toMatchObject({
      name: "NotAllowedError",
    });
  });
});

describe("recupererVisuelsUniformises", () => {
  // Avant : la boucle était nue, un seul 404 rejetait la requête entière et le
  // créateur perdait les quatre autres photos sans un mot.
  it("garde les visuels joignables et signale ceux qui manquent", async () => {
    vi.stubGlobal("navigator", {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // Toutes au même format : `ratioDominant` ne demande aucun recadrage, donc
    // le test ne porte que sur la tolérance aux visuels injoignables.
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 1080, height: 1440, close: () => {} })),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("3")
          ? ({ ok: false, status: 404 } as Response)
          : ({ ok: true, blob: async () => ({ type: "image/jpeg" }) } as unknown as Response),
      ),
    );

    const resultat = await recupererVisuelsUniformises(
      [1, 2, 3, 4, 5].map((n) => ({ url: `https://x/propre/${n}.jpg`, nom: `s${n}.jpg` })),
    );

    expect(resultat.fichiers).toHaveLength(4);
    expect(resultat.manquants).toEqual(["s3.jpg"]);
  });
});
