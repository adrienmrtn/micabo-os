import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { en } from "./en";
import { fr } from "./fr";

/**
 * Toute clé `t("…")` du code doit exister, et les deux langues doivent porter
 * les mêmes clés.
 *
 * Écrit après le retrait de CM paper / AI Videos (14/09/2026) : purger les
 * namespaces morts des locales a emporté quatre clés qu'utilisaient encore des
 * pages gardées. i18next ne jette pas — il affiche la clé brute. La prod a donc
 * montré « labels.creerPost » et « creation.pinned » en toutes lettres, sans
 * qu'aucun test, ni le typecheck, ni le build ne bronchent.
 *
 * Le test ne voit que les clés écrites en littéral. Une clé construite
 * (`t(\`posts.lien_${motif}\`)`) lui échappe — il ne remplace pas la relecture,
 * il attrape ce qui se casse en masse quand on supprime une fonctionnalité.
 */

// `import.meta.url` passe par le serveur Vite (`/@fs/…`) : inutilisable pour
// lire le disque. Vitest tourne depuis la racine du projet.
const RACINE = process.cwd();

function feuilles(obj: object, prefixe: string[] = []): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object"
      ? feuilles(v as object, [...prefixe, k])
      : [[...prefixe, k].join(".")],
  );
}

function fichiersSource(dossier: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      out.push(...fichiersSource(chemin));
    } else if (
      /\.tsx?$/.test(chemin) &&
      !chemin.includes(`${join("src", "locales")}`) &&
      !chemin.includes(".test.")
    ) {
      out.push(chemin);
    }
  }
  return out;
}

/** `t("a.b")` — littéral seulement : une clé interpolée n'est pas vérifiable ici. */
const APPEL_T = /\bt\(\s*"([a-zA-Z0-9_.]+)"/g;

const clesFr = new Set(
  feuilles(fr.translation).map((k) => k.replace(/_(one|other|zero)$/, "")),
);
const clesEn = new Set(
  feuilles(en.translation).map((k) => k.replace(/_(one|other|zero)$/, "")),
);

describe("clés de traduction", () => {
  it("chaque t(\"…\") du code existe dans fr", () => {
    const manquantes: string[] = [];
    for (const fichier of fichiersSource(join(RACINE, "src"))) {
      const source = readFileSync(fichier, "utf8");
      for (const m of source.matchAll(APPEL_T)) {
        if (!clesFr.has(m[1]!)) {
          manquantes.push(`${m[1]} (${fichier.replace(`${RACINE}/`, "")})`);
        }
      }
    }
    expect([...new Set(manquantes)]).toEqual([]);
  });

  it("fr et en portent les mêmes clés", () => {
    expect([...clesFr].filter((k) => !clesEn.has(k))).toEqual([]);
  });
});
