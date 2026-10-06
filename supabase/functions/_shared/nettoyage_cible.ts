/**
 * Géométrie du nettoyage ciblé (02/10/2026) — module PUR, réexporté par
 * `src/features/moteur/nettoyageCible.ts` pour Vitest.
 *
 * Un modèle de vision rend deux listes de rectangles : ce qu'il faut effacer
 * (la légende ajoutée) et ce qu'il faut garder près d'elle (logo d'une IA
 * notée, copie avec sa note). Le masque ne doit JAMAIS mordre sur le second :
 * LaMa reconstruit tout ce qui est sous le masque, donc un logo touché à moitié
 * est un logo abîmé. Une zone à effacer qui chevauche une zone à garder est
 * rognée du côté qui lui laisse le plus de surface, et abandonnée s'il ne lui
 * en reste pas assez — mieux vaut une légende qui reste qu'une note effacée.
 */

export interface ZoneFraction {
  /** Fractions de la largeur/hauteur, origine en haut à gauche. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ZoneNommee = ZoneFraction & { quoi: string };

/** Marge autour d'une zone à effacer : LaMa laisse un liseré si le masque est trop serré. */
export const MARGE_EFFACEMENT = 0.012;

/** En dessous de cette part de sa surface d'origine, une zone rognée n'efface plus rien d'utile. */
export const SURFACE_MIN_ROGNEE = 0.35;

/** Lit la sortie du modèle : fractions, ou l'échelle 0-1000 de Gemini. */
export function zonesNommees(liste: unknown): ZoneNommee[] {
  if (!Array.isArray(liste)) return [];
  const out: ZoneNommee[] = [];
  for (const z of liste as Array<Record<string, unknown>>) {
    if (!z || typeof z !== "object") continue;
    let [x, y, w, h] = [Number(z.x), Number(z.y), Number(z.w), Number(z.h)];
    if ([x, y, w, h].some((n) => !Number.isFinite(n))) continue;
    if (Math.max(x, y, w, h) > 1.5) [x, y, w, h] = [x / 1000, y / 1000, w / 1000, h / 1000];
    if (w <= 0 || h <= 0) continue;
    out.push({ x, y, w, h, quoi: String(z.quoi ?? "") });
  }
  return out;
}

function borner(z: ZoneFraction): ZoneFraction {
  const x = Math.max(0, z.x);
  const y = Math.max(0, z.y);
  return { x, y, w: Math.max(0, Math.min(1, z.x + z.w) - x), h: Math.max(0, Math.min(1, z.y + z.h) - y) };
}

/** Rogne `e` hors de `k`, du côté qui lui garde le plus de surface. */
export function rognerHors(e: ZoneFraction, k: ZoneFraction): ZoneFraction {
  const ex2 = e.x + e.w, ey2 = e.y + e.h, kx2 = k.x + k.w, ky2 = k.y + k.h;
  if (e.x >= kx2 || k.x >= ex2 || e.y >= ky2 || k.y >= ey2) return e;
  const candidats: ZoneFraction[] = [
    { x: e.x, y: e.y, w: k.x - e.x, h: e.h },
    { x: kx2, y: e.y, w: ex2 - kx2, h: e.h },
    { x: e.x, y: e.y, w: e.w, h: k.y - e.y },
    { x: e.x, y: ky2, w: e.w, h: ey2 - ky2 },
  ].filter((c) => c.w > 0 && c.h > 0);
  if (candidats.length === 0) return { ...e, w: 0, h: 0 };
  return candidats.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));
}

/** Le masque final : zones à effacer, élargies de la marge, rognées hors des zones à garder. */
export function masqueSur(
  effacer: ZoneNommee[],
  garder: ZoneFraction[],
): { retenues: ZoneFraction[]; notes: string[] } {
  const retenues: ZoneFraction[] = [];
  const notes: string[] = [];
  for (const e of effacer) {
    const origine = borner({
      x: e.x - MARGE_EFFACEMENT,
      y: e.y - MARGE_EFFACEMENT,
      w: e.w + 2 * MARGE_EFFACEMENT,
      h: e.h + 2 * MARGE_EFFACEMENT,
    });
    let z = origine;
    for (const k of garder) z = rognerHors(z, k);
    const part = (z.w * z.h) / Math.max(origine.w * origine.h, 1e-9);
    if (part < SURFACE_MIN_ROGNEE) {
      notes.push(`« ${e.quoi} » abandonnée : elle recouvre un élément à garder`);
      continue;
    }
    if (part < 0.999) notes.push(`« ${e.quoi} » rognée à ${Math.round(part * 100)} % pour épargner un élément à garder`);
    retenues.push(z);
  }
  return { retenues, notes };
}
