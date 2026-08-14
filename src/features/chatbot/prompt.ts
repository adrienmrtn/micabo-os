export const QUESTION_MAX = 1_500;
export const CONTEXTE_MAX = 24_000;

export type ChatRole = "admin" | "poster" | "hiring_manager";
export type ChatLocale = "fr" | "en";

export interface DocumentContexte {
  titre: string;
  titre_en: string | null;
  contenu: string;
  contenu_en: string | null;
  audience: "manager" | "poster" | "all";
}

export interface SnippetContexte {
  titre: string;
  contenu: string;
}

export interface TourChat {
  role: "user" | "assistant";
  content: string;
}

export function htmlVersTexte(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/(div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function audiencesPour(role: ChatRole): Array<DocumentContexte["audience"]> {
  if (role === "poster") return ["poster", "all"];
  if (role === "hiring_manager") return ["manager", "all"];
  return ["manager", "poster", "all"];
}

export function assemblerContexte(
  snippets: SnippetContexte[],
  docs: DocumentContexte[],
  role: ChatRole,
  locale: ChatLocale,
): string {
  const blocs: string[] = [];

  for (const s of snippets) {
    const texte = htmlVersTexte(s.contenu);
    if (!texte) continue;
    blocs.push(`### ${s.titre.trim() || "Sans titre"}\n${texte}`);
  }

  const autorise = new Set(audiencesPour(role));
  for (const doc of docs) {
    if (!autorise.has(doc.audience)) continue;
    const en = locale === "en";
    const titre = en && doc.titre_en?.trim() ? doc.titre_en : doc.titre;
    const brut = en && doc.contenu_en?.trim() ? doc.contenu_en : doc.contenu;
    const texte = htmlVersTexte(brut);
    if (!texte) continue;
    blocs.push(`### ${titre}\n${texte}`);
  }

  const joint = blocs.join("\n\n");
  if (joint.length <= CONTEXTE_MAX) return joint;
  return `${joint.slice(0, CONTEXTE_MAX)}\n\n[…contexte tronqué]`;
}
