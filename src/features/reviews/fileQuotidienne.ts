import { idPostTiktokStrict } from "@/features/moteur/oubliSource";

export const CLE_REMARQUES = "review_quotidienne_remarques";

export const REMARQUES_DEFAUT = [
  "Hook trop petit, on le lit trop tard",
  "Texte mal calé sur l'image",
  "Rythme trop lent vs l'original",
  "Les slides ne suivent pas l'original",
  "Musique trop basse ou coupée",
  "Bien calé — continue comme ça",
] as const;

export const REMARQUE_MAX = 160;
export const REMARQUES_MAX = 24;

export function jourParisDe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}

/** Réglage jamais posé → défauts. Tableau vide admin = aucune puce. */
export function remarquesDepuisReglage(brut: unknown | null | undefined): string[] {
  if (brut === undefined || brut === null) return [...REMARQUES_DEFAUT];
  return normaliserRemarques(brut);
}

export function normaliserRemarques(brut: unknown): string[] {
  if (!Array.isArray(brut)) return [];
  const out: string[] = [];
  const vus = new Set<string>();
  for (const x of brut) {
    const t = String(x ?? "").replace(/\s+/g, " ").trim().slice(0, REMARQUE_MAX);
    if (!t) continue;
    const cle = t.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push(t);
    if (out.length >= REMARQUES_MAX) break;
  }
  return out;
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
  const id = idPostTiktokStrict(url);
  if (!id) return null;
  return `https://www.tiktok.com/embed/v2/${id}`;
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
