import {
  estLienCourtTiktok,
  extraireIdTiktok,
  urlEmbedTikTokDepuisId,
} from "../../../supabase/functions/_shared/tiktok_lien.ts";

export { estLienCourtTiktok, extraireIdTiktok, urlEmbedTikTokDepuisId };

export const CLE_REMARQUES = "review_quotidienne_remarques";

export interface RemarqueGenerique {
  titre: string;
  corps: string;
}

export const REMARQUES_DEFAUT: RemarqueGenerique[] = [
  { titre: "Hook trop petit", corps: "Hook trop petit, on le lit trop tard" },
  { titre: "Texte mal calé", corps: "Texte mal calé sur l'image" },
  { titre: "Rythme trop lent", corps: "Rythme trop lent vs l'original" },
  { titre: "Slides différentes", corps: "Les slides ne suivent pas l'original" },
  { titre: "Musique", corps: "Musique trop basse ou coupée" },
  { titre: "Bien calé", corps: "Bien calé — continue comme ça" },
];

export const TITRE_MAX = 48;
export const CORPS_MAX = 800;
export const REMARQUE_MAX = CORPS_MAX;
export const REMARQUES_MAX = 24;

export function jourParisDe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}

/** Réglage jamais posé → défauts. Tableau vide admin = aucune puce. */
export function remarquesDepuisReglage(brut: unknown | null | undefined): RemarqueGenerique[] {
  if (brut === undefined || brut === null) return REMARQUES_DEFAUT.map((r) => ({ ...r }));
  return normaliserRemarques(brut);
}

export function normaliserRemarques(brut: unknown): RemarqueGenerique[] {
  if (!Array.isArray(brut)) return [];
  const out: RemarqueGenerique[] = [];
  const vus = new Set<string>();
  for (const x of brut) {
    const r = remarqueDepuisBrut(x);
    if (!r) continue;
    const cle = r.titre.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push(r);
    if (out.length >= REMARQUES_MAX) break;
  }
  return out;
}

function compact(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function remarqueDepuisBrut(x: unknown): RemarqueGenerique | null {
  if (typeof x === "string") {
    const t = compact(x).slice(0, CORPS_MAX);
    if (!t) return null;
    const coupe = t.search(/[,—]/);
    const titre = compact(coupe > 0 ? t.slice(0, coupe) : t).slice(0, TITRE_MAX);
    return { titre: titre || t.slice(0, TITRE_MAX), corps: t };
  }
  if (!x || typeof x !== "object") return null;
  const o = x as { titre?: unknown; corps?: unknown; title?: unknown; body?: unknown };
  const corps = compact(String(o.corps ?? o.body ?? "")).slice(0, CORPS_MAX);
  const titre = compact(String(o.titre ?? o.title ?? "")).slice(0, TITRE_MAX);
  if (!titre && !corps) return null;
  return { titre: titre || corps.slice(0, TITRE_MAX), corps: corps || titre };
}

export function collerRemarque(actuel: string, remarque: string): string {
  const ajout = remarque.trim();
  if (!ajout) return actuel;
  const t = actuel.replace(/\s+$/, "");
  if (!t) return ajout;
  if (t.split(/\n/).some((l) => l.trim().toLowerCase() === ajout.toLowerCase())) return actuel;
  return `${t}\n${ajout}`;
}

export function urlEmbedTikTok(url: string | null | undefined): string | null {
  return urlEmbedTikTokDepuisId(extraireIdTiktok(url));
}

export function estHorsFile(opts: {
  postId: string;
  publieAt: string | null;
  jour: string;
  deja: ReadonlySet<string>;
}): boolean {
  if (opts.deja.has(opts.postId)) return true;
  return jourParisDe(opts.publieAt) !== opts.jour;
}
