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
/** Règles de traduction par défaut, surchargeables depuis l'admin (clé
 *  `translate`). Le format de sortie JSON, lui, reste fixé dans le code pour
 *  qu'une édition ne casse jamais le parsing. */
export const DEFAULT_TRANSLATE_PROMPT = `Règles de traduction impératives :
- Tutoiement systématique ("tu"), jamais "vous".
- Écris comme un humain parle, pas comme un site de marketing.
- Phrases courtes. On lit au pouce, en une seconde.
- INTERDIT : le tiret long (—) et le tiret demi-cadratin (–). Utilise une
  virgule, un point ou deux-points. Ces tirets trahissent un texte d'IA.
- INTERDIT : "plonge dans", "libère ton potentiel", "révolutionne",
  "incontournable", "game changer", "booste", "transforme ta vie", et tout
  autre mot creux de ce registre.
- Pas de point d'exclamation en rafale, pas d'emoji ajouté.
- Voix cohérente avec le reste du slideshow.
- Aucune mention d'un produit tiers : ni application, ni site, ni logiciel, ni
  "outil d'IA", ni marque. Réécris le conseil comme une action pure ("entraîne
  ton élocution à voix haute", pas "utilise une appli pour t'entraîner"). Le
  seul produit qui a le droit d'exister dans ce slideshow, c'est Sophia, et ce
  n'est pas ton rôle de l'ajouter ici.
- Conserve les URLs et les sources citées telles quelles.`;

export async function extractAndTranslate(
  imageUrl: string,
  slideshowContext: string,
  rules: string = DEFAULT_TRANSLATE_PROMPT,
): Promise<{ extracted: string; translated: string }> {
  const image = await fetchImageAsInline(imageUrl);

  const prompt = `Tu analyses une slide d'un slideshow TikTok.

1. Transcris exactement le texte visible sur l'image.
2. Traduis-le en français, pour être lu sur TikTok.

${rules}

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

/**
 * Note la pertinence d'un slideshow pour une pub Sophia (app de culture
 * générale). Évite de payer nettoyage et traduction sur un contenu inutilisable.
 */
export const DEFAULT_RELEVANCE_PROMPT = `Sophia est une application de culture
générale : elle aide à apprendre, à enrichir ses connaissances et à devenir
plus cultivé.

Note de 0 à 100 la pertinence de ce slideshow pour y glisser naturellement un
conseil menant à Sophia.

Notes hautes : savoir, culture, apprentissage, éloquence, conversation,
curiosité, lecture, mémoire, esprit critique ("devenir exceptionnellement
cultivé", "être intéressant en soirée", "paraître plus intelligent").

Notes basses : fitness, beauté, séduction, argent, productivité pure, ou tout
sujet où parler d'une app de culture générale sonnerait plaqué.`;

export async function scoreRelevance(input: {
  caption: string;
  hookText: string;
  instructions?: string;
}): Promise<{ score: number; reason: string }> {
  const prompt = `${input.instructions ?? DEFAULT_RELEVANCE_PROMPT}

Slideshow candidat :
Accroche : ${input.hookText || "(inconnue)"}
Légende : ${input.caption || "(aucune)"}

Réponds uniquement en JSON, sans bloc de code :
{"score": 0-100, "reason": "une phrase"}`;

  const parts = await callWithFallback(TEXT_MODELS, [{ text: prompt }]);
  const raw = textOf(parts).replace(/^```(?:json)?|```$/g, "").trim();

  try {
    const parsed = JSON.parse(raw);
    return {
      score: Number(parsed.score) || 0,
      reason: String(parsed.reason ?? ""),
    };
  } catch {
    return { score: 0, reason: raw.slice(0, 200) };
  }
}

/**
 * Intègre Sophia dans le slideshow en REMPLAÇANT l'un des conseils existants,
 * pas en ajoutant une slide. Le modèle choisit lui-même le conseil le plus
 * substituable et le réécrit au même format, même longueur, même ton — la
 * couture ne doit pas se voir.
 */
export async function integrateSophia(input: {
  masterPrompt: string;
  corrections: Array<{ original_text: string | null; corrected_text: string }>;
  slides: Array<{ position: number; text: string }>;
  caption: string;
}): Promise<{ position: number; text: string } | null> {
  const examples = input.corrections
    .slice(0, 40)
    .map((c) =>
      c.original_text
        ? `- Au lieu de : "${c.original_text}"\n  Écris plutôt : "${c.corrected_text}"`
        : `- Bon exemple : "${c.corrected_text}"`,
    )
    .join("\n");

  const slideList = input.slides
    .map((s) => `${s.position}. ${s.text || "(vide)"}`)
    .join("\n");

  const prompt = `${input.masterPrompt}

Voici un slideshow TikTok complet. La slide 1 est l'accroche, les suivantes
sont des conseils.

${slideList}

Légende : ${input.caption || "(aucune)"}
${examples ? `\nCorrections passées à respecter :\n${examples}\n` : ""}
Ta mission : choisir UN conseil (jamais l'accroche, jamais la slide 1) et le
réécrire pour que Sophia en soit la réponse.

Impératifs :
- Choisis le conseil où Sophia s'insère le plus naturellement au vu de l'accroche.
- Le texte réécrit doit avoir la MÊME longueur, le MÊME format et le MÊME ton
  que les autres slides. Un lecteur ne doit pas pouvoir deviner laquelle a changé.
- Ça reste un conseil, pas une publicité. Sophia est la façon d'appliquer le
  conseil, pas le sujet de la phrase.
- Tutoiement.
- INTERDIT : le tiret long (—) et le tiret demi-cadratin (–).
- INTERDIT : le jargon marketing ("libère ton potentiel", "incontournable",
  "révolutionne", "game changer").
- Pas de superlatif sur l'app, pas de "télécharge", pas d'appel à l'action.

Réponds uniquement en JSON, sans bloc de code :
{"position": <numéro de la slide remplacée>, "text": "<le nouveau texte>"}`;

  const parts = await callWithFallback(TEXT_MODELS, [{ text: prompt }]);
  const raw = textOf(parts).replace(/^```(?:json)?|```$/g, "").trim();

  try {
    const parsed = JSON.parse(raw);
    const position = Number(parsed.position);
    const text = String(parsed.text ?? "").trim();

    // L'accroche porte la promesse du slideshow : la remplacer casserait tout.
    if (!position || position < 2 || !text) return null;

    return { position, text };
  } catch {
    return null;
  }
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
