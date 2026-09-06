/** Documents OS dont Talks tire les réponses (pas d'invention). */
export const CLES_DOCS_UPWORK = [
  "reponses_upwork",
  "faq_manager",
  "guide_manager",
  "onboarding",
] as const;

export type DocSavoir = {
  cle: string;
  titre: string;
  contenu: string;
  contenu_en: string | null;
};

export type EntreeSavoir = { titre: string; corps: string };

export const CONSIGNE_DEFAUT =
  "Pas de tirets cadratins. Ton direct. Un smiley max.";

const STOP = new Set(
  "the a an to of in on for and or how do we i you are is was can get je tu un une de du des la le les et ou en est pas pour avec dans".split(
    " ",
  ),
);

export function htmlVersTexte(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|div|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extraireEntrees(html: string): EntreeSavoir[] {
  const morceaux = html.split(/<h[1-6][^>]*>/i);
  const out: EntreeSavoir[] = [];
  for (const morceau of morceaux) {
    const m = morceau.match(/^([\s\S]*?)<\/h[1-6]>([\s\S]*)$/i);
    if (!m) continue;
    const titre = htmlVersTexte(m[1] ?? "");
    const corps = htmlVersTexte(m[2] ?? "");
    if (titre && corps) out.push({ titre, corps });
  }
  if (out.length === 0) {
    const corps = htmlVersTexte(html);
    if (corps) out.push({ titre: "", corps });
  }
  return out;
}

function mots(texte: string): string[] {
  return (
    texte
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .match(/[a-z0-9]{3,}/g) ?? []
  );
}

function scoreEntree(query: string, entree: EntreeSavoir): number {
  const q = new Set(mots(query).filter((w) => !STOP.has(w)));
  if (q.size === 0) return 0;
  const cible = mots(`${entree.titre} ${entree.titre} ${entree.corps}`);
  let n = 0;
  for (const w of cible) if (q.has(w)) n += 1;
  return n;
}

export function texteDocument(doc: DocSavoir, langue: string | null): string {
  if (langue === "fr") return doc.contenu;
  return doc.contenu_en?.trim() || doc.contenu;
}

/** Le passage du document qui répond le mieux à leur dernier message. */
export function reponseDepuisDocuments(
  dernier: string,
  docs: DocSavoir[] | undefined,
  langue: string | null,
): string | null {
  if (!dernier.trim() || !docs?.length) return null;
  let meilleur: { score: number; corps: string } | null = null;
  for (const doc of docs) {
    for (const entree of extraireEntrees(texteDocument(doc, langue))) {
      const score = scoreEntree(dernier, entree);
      if (score < 2) continue;
      if (!meilleur || score > meilleur.score) {
        meilleur = { score, corps: entree.corps };
      }
    }
  }
  return meilleur?.corps ?? null;
}

/**
 * Applique la consigne de style de la page Upwork au texte déjà composé.
 * L'admin relit le résultat ; l'agent l'envoie tel quel.
 */
export function appliquerConsigne(texte: string, consigne: string | null | undefined): string {
  const c = (consigne ?? "").toLowerCase();
  let t = texte.replace(/\u2014|\u2013/g, "-");
  if (/sans smiley|no (?:smiley|emoji)|pas de smiley/.test(c)) {
    t = t.replace(/\p{Extended_Pictographic}/gu, "").replace(/[ \t]{2,}/g, " ");
  } else if (/smiley|emoji|emoticone|émoticône/.test(c)) {
    if (!/\p{Extended_Pictographic}/u.test(t)) {
      t = t.replace(/^(Bonjour [^,\n]+,|Hi [^,\n]+,)/, "$1 🙂");
    }
  }
  return t.replace(/\n{3,}/g, "\n\n").trim();
}
