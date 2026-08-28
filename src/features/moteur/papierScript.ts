/** Helpers purs du master papier (script, durée, CTA, prompts visuels). */

export const MICABO_OUTRO =
  "Tes cours deviennent des flashcards : révise 10 minutes par jour avec micabo.";
/** @deprecated Même texte que MICABO_OUTRO — plus aucun CTA produit tiers. */
export const SOPHIA_OUTRO = MICABO_OUTRO;

export const MOTS_PAR_SECONDE = 2.6;

export type PapierKind = "faits" | "culture" | "pub";
export type PapierNarrationStyle = "question" | "revelation" | "storytelling" | "listicle";
export type DureeCibleClip = 4 | 6 | 8;

export type PapierSceneScript = {
  index: number;
  narration: string;
  overlay: string;
  imagePrompt: string;
  videoPrompt: string;
};

export type PapierCharacterSheet = { name: string; description: string };

export type PapierScript = {
  title: string;
  hook: string;
  scenes: PapierSceneScript[];
  cta: string;
  hashtags: string[];
  characters?: PapierCharacterSheet[];
  palette?: string;
};

const SQUARE_FRAME =
  "Framing: the whole scene is composed inside a perfect centered square (1:1) with softly rounded corners, touching the left and right edges; above and below that square the frame is pure solid black, completely empty, like a rounded square clip letterboxed in a vertical canvas. Nothing of the scene spills into the black bands or past the rounded corners.";

export const PAPERCRAFT_VISUAL =
  "handmade layered paper cut-out diorama photographed head-on, flat frontal composition, stacked planes of matte construction paper with torn deckled edges and visible paper grain, simple bold silhouettes with no fine detail, characters and objects built from flat cut shapes with slight relief, soft diffused studio light casting gentle drop shadows between paper layers, a cohesive limited palette of 4 to 5 flat matte paper colors chosen to fit the mood of this specific scene, no gradients, no realistic textures, no 3D render look, stop-motion paper animation aesthetic, calm and graphic, quiet minimal background of layered paper shapes";

export const PAPERCRAFT_QUALITY =
  "shot straight on like a real photograph of a physical paper set, shallow relief depth, crisp paper edges, no digital illustration look, no cartoon outlines, no glossy plastic, no clay";

export const PAPERCRAFT_MOTION =
  "Stop-motion paper animation: the paper cut-outs move in small discrete steps, slight handmade jitter, layers sliding over each other, static or very slow push-in camera.";

export function compterMots(texte: string): number {
  return texte.trim().split(/\s+/).filter(Boolean).length;
}

export function estimerSecondesParole(texte: string): number {
  return compterMots(texte) / MOTS_PAR_SECONDE;
}

export function dureeCibleClip(texte: string): DureeCibleClip {
  const sec = estimerSecondesParole(texte);
  if (sec <= 4) return 4;
  if (sec <= 6) return 6;
  return 8;
}

export function extraireJson<T>(texte: string): T {
  const fenced = texte.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? texte).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("JSON introuvable dans la réponse modèle");
  }
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

const CTA_RE = /\b(sophia|micabo|t[ée]l[ée]charge|l'appli|l'application|ouvre micabo)\b/i;

export function estSceneCta(narration: string): boolean {
  return CTA_RE.test(narration);
}

export function retirerScenesCtaQueue(scenes: PapierSceneScript[]): PapierSceneScript[] {
  const out = scenes.slice();
  while (out.length > 2 && estSceneCta(out[out.length - 1]?.narration ?? "")) {
    out.pop();
  }
  return out;
}

export function remplacerSophiaParAppli(texte: string): string {
  return texte.replace(/\bSophia\b/gi, "l'appli");
}

export function normaliserCtaMicaboUnique(cta: string): string {
  const base = (cta.trim() || MICABO_OUTRO)
    .replace(/\bSophia\b/gi, "micabo")
    .replace(/\s{2,}/g, " ")
    .trim();
  let seen = false;
  return base
    .replace(/\bmicabo\b/gi, () => {
      if (seen) return "l'appli";
      seen = true;
      return "micabo";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** @deprecated Utiliser normaliserCtaMicaboUnique — zéro nom de produit tiers. */
export function normaliserCtaSophiaUnique(cta: string): string {
  return normaliserCtaMicaboUnique(cta);
}

export function sceneCta(cta: string, index: number): PapierSceneScript {
  return {
    index,
    narration: cta,
    overlay: "Ouvre micabo",
    imagePrompt:
      "a hand holding a simple smartphone showing a clean study app screen, small floating book and lightbulb shapes around it, calm background",
    videoPrompt:
      "static frontal shot, the smartphone rises slightly while small book and lightbulb shapes float gently around it",
  };
}

export function finaliserScript(brut: Partial<PapierScript>, sceneCount: number): PapierScript {
  const scenesBrutes = Array.isArray(brut.scenes) ? brut.scenes : [];
  let scenes = scenesBrutes.slice(0, sceneCount).map((s, i) => ({
    index: i,
    narration: String(s?.narration ?? "").trim(),
    overlay: String(s?.overlay ?? "").trim(),
    imagePrompt: String(s?.imagePrompt ?? "").trim(),
    videoPrompt: String(s?.videoPrompt ?? s?.imagePrompt ?? "").trim(),
  }));
  scenes = retirerScenesCtaQueue(scenes).map((s, i) => ({
    ...s,
    index: i,
    narration: remplacerSophiaParAppli(s.narration),
  }));
  const cta = normaliserCtaSophiaUnique(String(brut.cta ?? ""));
  scenes.push(sceneCta(cta, scenes.length));
  return {
    title: String(brut.title ?? "").trim() || "Papier du jour",
    hook: String(brut.hook ?? scenes[0]?.narration ?? "").trim(),
    scenes,
    cta,
    hashtags: Array.isArray(brut.hashtags)
      ? brut.hashtags.map((h) => String(h)).filter(Boolean).slice(0, 8)
      : [],
    characters: Array.isArray(brut.characters)
      ? brut.characters
          .map((c) => ({
            name: String(c?.name ?? "").trim(),
            description: String(c?.description ?? "").trim(),
          }))
          .filter((c) => c.name || c.description)
      : [],
    palette: String(brut.palette ?? "").trim() || undefined,
  };
}

export function budgetScript(targetSeconds: number, sceneCountMin = 5): {
  narrationSeconds: number;
  totalWords: number;
  sceneCount: number;
  wordsPerScene: number;
} {
  const narrationSeconds = Math.max(8, targetSeconds - 6);
  const totalWords = Math.round(narrationSeconds * MOTS_PAR_SECONDE);
  const sceneCount = Math.min(16, Math.max(sceneCountMin, Math.ceil(totalWords / 18)));
  const wordsPerScene = Math.min(22, Math.max(8, Math.round(totalWords / sceneCount)));
  return { narrationSeconds, totalWords, sceneCount, wordsPerScene };
}

export function bibleVisuelle(script: Pick<PapierScript, "characters" | "palette"> | null): string {
  if (!script) return "";
  const chars = (script.characters ?? [])
    .map((c) => `${c.name} : ${c.description}`.trim())
    .filter((s) => s !== ":")
    .join(" | ");
  return [chars, script.palette].filter(Boolean).join(" — ");
}

export function storyContext(
  scenes: Array<{ narration: string }>,
  index: number,
): string {
  const before = scenes
    .slice(Math.max(0, index - 3), index)
    .map((s, k) => `${index - Math.min(3, index) + k + 1}. ${s.narration}`)
    .join(" ");
  const next = scenes[index + 1]?.narration;
  return [
    before ? `Previously: ${before}` : "",
    `Now: ${scenes[index]?.narration ?? ""}`,
    next ? `Next: ${next}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function bibleLine(bible?: string) {
  return bible?.trim()
    ? ` Consistent series bible (identical in every shot of this video): ${bible.trim()}.`
    : "";
}

function storyLine(story?: string) {
  return story?.trim()
    ? ` STORY CONTEXT (this shot is one chapter of a single continuous illustrated story, keep the same world, same characters, same costumes, same palette and a logical visual progression): ${story.trim()}.`
    : "";
}

export function coverPromptPapier(
  imagePrompt: string,
  opts?: { bible?: string; story?: string },
): string {
  return `Vertical 9:16 key frame. ${PAPERCRAFT_VISUAL}. ${PAPERCRAFT_QUALITY}.${bibleLine(opts?.bible)}${storyLine(opts?.story)} ${SQUARE_FRAME} Absolutely no text, no letters, no watermark, no logo. Scene: ${imagePrompt}`;
}

export function motionPromptPapier(
  videoPrompt: string,
  opts?: { bible?: string; story?: string },
): string {
  return `${videoPrompt}. Vertical short-form video. ${PAPERCRAFT_VISUAL}. ${PAPERCRAFT_QUALITY}.${bibleLine(opts?.bible)}${storyLine(opts?.story)} ${SQUARE_FRAME} The black bands stay perfectly static. ${PAPERCRAFT_MOTION} Consistent art direction, same characters and same colors as the reference image, no on-screen text, no subtitles, no watermark.`;
}

export function compterSophia(texte: string): number {
  return (texte.match(/\bSophia\b/gi) ?? []).length;
}

export function compterMicabo(texte: string): number {
  return (texte.match(/\bmicabo\b/gi) ?? []).length;
}
