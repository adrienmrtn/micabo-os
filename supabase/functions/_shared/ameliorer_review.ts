/**
 * Prompt text-to-text pour la review du jour.
 * Forme + fautes + phrases incomplètes, sortie toujours en anglais.
 * N'invente pas de reproches : uniquement ce que l'admin a écrit.
 */

export const REVIEW_AMELIORER_MAX = 4000;

export function promptAmeliorerReview(texte: string): string {
  return [
    "You rewrite feedback from an admin to a TikTok creator.",
    "The creator reproduced a study/exam slideshow for students (notes, flashcards, revision).",
    "",
    "Rules:",
    "- Output English only. Translate if the draft is in another language.",
    "- Keep the reviewer's meaning. Do not add new praise, criticism, or facts.",
    "- Fix spelling and grammar. Complete truncated sentences without inventing points.",
    "- Improve formatting (short paragraphs or dashes) if it helps reading.",
    "- If the product is named, write micabo in lowercase. Never name another product.",
    "- Return only the rewritten review. No title, no preamble, no quotes around it.",
    "",
    "Draft:",
    texte.trim(),
  ].join("\n");
}
