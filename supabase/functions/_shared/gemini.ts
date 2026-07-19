import { downloadImage } from "./apify.ts";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Modèles utilisés, par ordre de repli. gemini-2.5-pro est volontairement
 * absent : il apparaît dans la liste des modèles mais renvoie 404 « no longer
 * available to new users » sur les clés récentes.
 */
export const TEXT_MODELS = ["gemini-2.5-flash", "gemini-3.5-flash"];

/**
 * Le refus de retouche est inconstant : le même modèle accepte une image et en
 * refuse une autre. On enchaîne donc plusieurs modèles avant d'abandonner.
 */
export const IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image",
  "gemini-3-pro-image",
];

/**
 * L'API accepte `inline_data` en entrée mais répond en `inlineData` : les deux
 * formes doivent coexister, sinon on cherche une clé qui n'existe jamais dans
 * la réponse.
 */
interface Part {
  text?: string;
  inline_data?: { mime_type: string; data: string };
  inlineData?: { mimeType: string; data: string };
}

function imageDataOf(parts: Part[]): string | null {
  for (const part of parts) {
    const data = part.inlineData?.data ?? part.inline_data?.data;
    if (data) return data;
  }
  return null;
}

function apiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY manquant");
  return key;
}

async function call(model: string, parts: Part[]): Promise<Part[]> {
  const response = await fetch(`${BASE}/${model}:generateContent?key=${apiKey()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }] }),
  });

  if (!response.ok) {
    throw new Error(`Gemini ${model} ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const data = await response.json();
  return (data?.candidates?.[0]?.content?.parts ?? []) as Part[];
}

function textOf(parts: Part[]): string {
  return parts
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

/**
 * Essaie chaque modèle à tour de rôle. Toutes les erreurs sont agrégées : ne
 * remonter que la dernière masquait la cause réelle derrière l'échec du modèle
 * de repli, ce qui a déjà coûté un cycle de diagnostic.
 */
async function callWithFallback(models: string[], parts: Part[]): Promise<Part[]> {
  const failures: string[] = [];

  for (const model of models) {
    try {
      return await call(model, parts);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(failures.join(" | "));
}

export async function fetchImageAsInline(url: string): Promise<Part> {
  // Passe par le helper Apify : les visuels issus du key-value store exigent
  // le token, ceux déjà rapatriés dans notre Storage sont servis tels quels.
  const buffer = await downloadImage(url);

  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
  }

  return {
    inline_data: {
      mime_type: url.toLowerCase().includes(".png") ? "image/png" : "image/jpeg",
      data: btoa(binary),
    },
  };
}

/**
 * OCR + traduction en une passe : demander les deux séparément ferait perdre
 * le contexte visuel qui lève la plupart des ambiguïtés de traduction.
 */
export async function extractAndTranslate(
  imageUrl: string,
  slideshowContext: string,
): Promise<{ extracted: string; translated: string }> {
  const image = await fetchImageAsInline(imageUrl);

  const prompt = `Tu analyses une slide d'un slideshow TikTok.

1. Transcris exactement le texte visible sur l'image.
2. Traduis-le en français.

Règles de traduction impératives :
- Tutoiement systématique ("tu"), jamais "vous".
- Voix cohérente avec le reste du slideshow.
- Tournures simples et naturelles, pas de jargon.
- Ne mentionne jamais une autre application : reformule en conseil générique.
- Conserve les URLs et les sources citées telles quelles.

Contexte du slideshow : ${slideshowContext || "(aucun)"}

Réponds uniquement en JSON, sans bloc de code :
{"extracted": "...", "translated": "..."}`;

  const parts = await callWithFallback(TEXT_MODELS, [{ text: prompt }, image]);
  const raw = textOf(parts).replace(/^```(?:json)?|```$/g, "").trim();

  try {
    const parsed = JSON.parse(raw);
    return {
      extracted: String(parsed.extracted ?? ""),
      translated: String(parsed.translated ?? ""),
    };
  } catch {
    // Le modèle a répondu en texte libre : on garde au moins la traduction.
    return { extracted: "", translated: raw };
  }
}

/** Génère un texte pub Sophia à insérer sur une slide. */
export async function generateSophiaText(input: {
  masterPrompt: string;
  corrections: Array<{ original_text: string | null; corrected_text: string }>;
  slideText: string;
  slideshowContext: string;
}): Promise<string> {
  const examples = input.corrections
    .slice(0, 40)
    .map((c) =>
      c.original_text
        ? `- Au lieu de : "${c.original_text}"\n  Écris plutôt : "${c.corrected_text}"`
        : `- Bon exemple : "${c.corrected_text}"`,
    )
    .join("\n");

  const prompt = `${input.masterPrompt}

${examples ? `Corrections passées à respecter :\n${examples}\n` : ""}
Contexte du slideshow : ${input.slideshowContext || "(aucun)"}
Texte de la slide cible : ${input.slideText || "(vide)"}

Réponds uniquement par le texte à insérer, sans guillemets ni commentaire.`;

  const parts = await callWithFallback(TEXT_MODELS, [{ text: prompt }]);
  return textOf(parts);
}

/**
 * Nettoyage d'image : retire captions, stickers et watermarks.
 *
 * Le modèle refuse parfois la retouche ; le refus n'est pas déterministe. On
 * repasse donc sur chaque modèle disponible avant de renoncer. Renvoie null si
 * aucun n'a rendu d'image — l'appelant conserve alors l'original plutôt que de
 * casser le slideshow.
 */
export async function cleanImage(imageUrl: string): Promise<string | null> {
  const image = await fetchImageAsInline(imageUrl);

  // Instruction volontairement courte : les consignes longues sur l'intégrité
  // du contenu font nettement plus souvent basculer le modèle vers un refus.
  const prompt =
    "Retire tous les textes incrustés de cette image en reconstituant " +
    "l'arrière-plan de façon naturelle. Ne change ni le cadrage, ni les " +
    "couleurs, ni le sujet.";

  for (const model of IMAGE_MODELS) {
    try {
      const parts = await call(model, [{ text: prompt }, image]);
      const data = imageDataOf(parts);
      if (data) return data;
    } catch {
      // Modèle indisponible ou en erreur : on passe au suivant.
    }
  }

  return null;
}

/** Vérifie qu'il ne reste pas de texte incrusté après nettoyage. */
export async function verifyClean(base64Image: string, mimeType: string): Promise<boolean> {
  const parts = await callWithFallback(TEXT_MODELS, [
    {
      text: `Reste-t-il du texte incrusté, un sticker ou un watermark sur cette image ?
Ignore les URLs et sources citées, qui sont légitimes.
Réponds uniquement par OUI ou NON.`,
    },
    { inline_data: { mime_type: mimeType, data: base64Image } },
  ]);

  return !textOf(parts).toUpperCase().includes("OUI");
}
