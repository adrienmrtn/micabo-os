import { generateTextFast } from "../_shared/gemini.ts";
import { assertRole, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

const QUESTION_MAX = 1_500;
const CONTEXTE_MAX = 24_000;

type Role = "admin" | "poster" | "hiring_manager";
type Locale = "fr" | "en";

interface DocumentLigne {
  titre: string;
  titre_en: string | null;
  contenu: string;
  contenu_en: string | null;
  audience: "manager" | "poster" | "all";
}

interface Snippet {
  titre: string;
  contenu: string;
}

interface Tour {
  role: "user" | "assistant";
  content: string;
}

function htmlVersTexte(html: string): string {
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

function audiencesPour(role: Role): Array<DocumentLigne["audience"]> {
  if (role === "poster") return ["poster", "all"];
  if (role === "hiring_manager") return ["manager", "all"];
  return ["manager", "poster", "all"];
}

function texteDocument(doc: DocumentLigne, locale: Locale): { titre: string; texte: string } {
  const en = locale === "en";
  const titre = en && doc.titre_en?.trim() ? doc.titre_en : doc.titre;
  const brut = en && doc.contenu_en?.trim() ? doc.contenu_en : doc.contenu;
  return { titre, texte: htmlVersTexte(brut) };
}

function assemblerContexte(
  snippets: Snippet[],
  docs: DocumentLigne[],
  role: Role,
  locale: Locale,
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
    const { titre, texte } = texteDocument(doc, locale);
    if (!texte) continue;
    blocs.push(`### ${titre}\n${texte}`);
  }

  const joint = blocs.join("\n\n");
  if (joint.length <= CONTEXTE_MAX) return joint;
  return `${joint.slice(0, CONTEXTE_MAX)}\n\n[…contexte tronqué]`;
}

function construirePrompt(input: {
  question: string;
  contexte: string;
  role: Role;
  locale: Locale;
  historique: Tour[];
}): string {
  const roleLabel =
    input.role === "poster" ? "créateur (poster)" : input.role === "hiring_manager" ? "hiring manager" : "admin";
  const langue = input.locale === "en" ? "English" : "français";

  const historique = input.historique
    .slice(-6)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n");

  return `Tu es l'assistant interne de Sophia (atelier de contenu TikTok).
Tu réponds UNIQUEMENT à partir du CONTEXTE ci-dessous (rédigé par l'admin, plus les guides/FAQ).
Si l'information n'y est pas, dis-le clairement : tu ne sais pas, et l'admin pourra compléter.
N'invente aucun process, chiffre, délai, mot de passe, ou règle.

Règles :
- Réponds en ${langue}, tutoiement, phrases courtes.
- Interlocuteur : ${roleLabel}.
- Pas d'em dash. Pas d'emoji sauf si le contexte en a.
- 1 à 8 phrases. Va droit au but.

CONTEXTE :
${input.contexte.trim() || "(vide — aucun document)"}

${historique ? `ÉCHANGES RÉCENTS :\n${historique}\n` : ""}
QUESTION :
${input.question}`;
}

Deno.serve(async (request) => {
  const acces = await assertRole(request, ["admin", "poster", "hiring_manager"]);
  if (acces instanceof Response) return acces;

  try {
    const body = await request.json();
    const question = (body?.question ?? "").toString().trim();
    if (!question) return json({ error: "Question vide" }, 400);
    if (question.length > QUESTION_MAX) {
      return json({ error: `Question trop longue (${QUESTION_MAX} caractères max)` }, 400);
    }

    const locale: Locale = body?.locale === "en" ? "en" : "fr";
    const role = acces.role as Role;
    const historiqueBrut = Array.isArray(body?.historique) ? body.historique : [];
    const historique: Tour[] = historiqueBrut
      .filter((t: unknown) => t && typeof t === "object")
      .map((t: { role?: string; content?: string }) => ({
        role: t.role === "assistant" ? "assistant" : "user",
        content: (t.content ?? "").toString().slice(0, QUESTION_MAX),
      }))
      .filter((t: Tour) => t.content.trim())
      .slice(-6);

    const db = serviceClient();
    const [{ data: snippets }, { data: docs }] = await Promise.all([
      db.from("chatbot_contexte").select("titre, contenu").order("updated_at", { ascending: false }),
      db.from("documents").select("titre, titre_en, contenu, contenu_en, audience"),
    ]);

    const contexte = assemblerContexte(
      (snippets ?? []) as Snippet[],
      (docs ?? []) as DocumentLigne[],
      role,
      locale,
    );
    const prompt = construirePrompt({ question, contexte, role, locale, historique });
    const reponse = (await generateTextFast(prompt)).trim();
    if (!reponse) return json({ error: "Réponse vide" }, 502);

    const { error: insertError } = await db.from("chatbot_questions").insert({
      user_id: acces.userId === "cron" ? null : acces.userId,
      role,
      question,
      reponse,
    });
    if (insertError) {
      // La réponse a déjà été produite : on la renvoie quand même.
      console.error("chatbot_questions insert", insertError);
    }

    return json({ ok: true, reponse });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
