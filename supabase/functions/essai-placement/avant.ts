/**
 * L'ANCIEN placement, figé tel qu'il tournait en production avant 0289 : les 3
 * dernières slides, le suffixe d'avant, et la variante écrite sans passer par
 * les règles de la marque. Il ne sert qu'à l'essai à blanc, pour comparer
 * l'ancien et le nouveau sur les mêmes decks. Ne pas le réutiliser ailleurs.
 */
import { callWithFallback, LANGUES, type SophiaPlacement, TEXT_MODELS, textOf } from "../_shared/gemini.ts";

export async function integrateSophiaAvant(input: {
  masterPrompt: string;
  corrections: Array<{ original_text: string | null; corrected_text: string }>;
  slides: Array<{ position: number; text: string }>;
  caption: string;
  /** Langue du compte : la slide de placement doit parler comme ses voisines. */
  langue?: string;
  /** Slug de l'application (sophia, micabo, …). */
  marque?: string;
}): Promise<SophiaPlacement | null> {
  // Sophia DOIT tomber dans les 2-3 dernières slides (jamais au début) : on borne
  // les positions permises aux 3 dernières (hors couverture = slide 1).
  const positions = input.slides.map((s) => s.position).sort((a, b) => a - b);
  const autorisees = positions.filter((p) => p >= 2).slice(-3);
  const autoriseesTxt = autorisees.join(", ");
  const examples = input.corrections
    .slice(0, 40)
    .map((c) =>
      c.original_text
        ? `- Au lieu de : "${c.original_text}"\n  Écris plutôt : "${c.corrected_text}"`
        : `- Bon exemple : "${c.corrected_text}"`,
    )
    .join("\n");

  const slideList = input.slides
    .map((s) => `Slide ${s.position} : "${s.text || "(vide)"}"`)
    .join("\n");

  const code = input.langue ?? "fr";
  const langue = LANGUES[code] ?? code;

  // Le prompt maître (édité par l'admin) porte toute la doctrine ; le code n'y
  // ajoute que les données du deck et un format de sortie JSON stable.
  //
  // La langue ouvre le prompt : une slide Sophia rédigée dans une autre langue
  // que ses voisines se repère immédiatement et ruine l'intégration.
  const prompt = `LANGUE DE SORTIE : ${langue.toUpperCase()}.
Les variantes que tu écris doivent être en ${langue}, quelle que soit la langue
des consignes ci-dessous.

${input.masterPrompt}

--- DONNÉES ---
Légende de la vidéo : ${input.caption || "(aucune)"}
Slides du slideshow (slide 1 = couverture) :
${slideList}
${examples ? `\nCorrections passées à respecter :\n${examples}\n` : ""}
--- SORTIE ---
Ne remplace jamais la slide 1 (couverture). Le placement de ${input.marque === "micabo" ? "micabo" : "Sophia"} doit toujours tomber dans les
2-3 DERNIÈRES slides, jamais avant : choisis UNE slide parmi ces positions
UNIQUEMENT : ${autoriseesTxt}. Écris 3 variantes qui remplacent son texte.
Chaque variante DOIT :
${input.marque === "micabo"
    ? `- MENTION DE micabo (toujours en minuscules) selon le TON des slides, sans formule publicitaire. micabo est une APPLICATION MOBILE, et il faut TOUJOURS le préciser : écris « l'appli micabo » ou « l'application micabo », jamais le nom nu — une slide se lit en une seconde et ne dit pas ce qu'est micabo, c'est le mot de catégorie qui fait ce travail. INTERDIT : « micabo.app », « le site micabo », « la plateforme micabo ».${
        code === "tr"
          ? `\n- TURC : « micabo uygulaması » (izafet), jamais le nom nu. Le suffixe de cas se pose sur le POSSESSIF, pas sur le nom : micabo uygulamasını, micabo uygulamasına, micabo uygulamasında, micabo uygulamasından, ou « micabo uygulaması ile ». Jamais « micabo'yu » seul, et jamais « micabo uygulaması'yu », qui n'existe pas. INTERDIT : « micabo.app », le mot « site » / « sitesi » sous toutes ses formes, et « indir / App Store » en formule publicitaire.`
          : ""
      }`
    : `- MENTION DE SOPHIA selon le TON des slides : si elles TUTOIENT (2e personne du
  singulier, « tu / ton / tes / tes... »), la mention doit être INDIRECTE — n'écris
  JAMAIS « utilise l'appli Sophia » ni « télécharge Sophia » ; écris plutôt une
  formule du type « utilise une appli de micro-apprentissage comme Sophia ». Si les
  slides sont à la 1re personne (« je / j'ai / mon »), une mention directe de Sophia
  est parfaitement acceptable (« j'utilise l'appli Sophia… »).`}
- reprendre EXACTEMENT le préfixe de la slide remplacée : si son texte commence
  par un numéro ("5.", "3)"), une puce ou un emoji, la variante commence par le
  MÊME. Ne change jamais le numéro, ne saute pas de numéro.
- faire une longueur comparable à ce texte (à ±20 % du nombre de caractères) :
  ni beaucoup plus courte, ni plus longue — elle occupe la même place à l'écran.
- COPIER la mise en forme des slides voisines : la MÊME casse (si elles sont
  tout en minuscules, reste tout en minuscules ; pas de majuscule d'emphase ni
  de Title Case qu'elles n'ont pas), la même ponctuation, les mêmes emojis ou
  retours à la ligne éventuels. La slide Sophia doit être indistinguable des
  autres au premier coup d'œil.
- rester dans le même mode grammatical et le même ton que les slides voisines,
  pour s'enchaîner sans rupture.

Puis applique l'autocontrôle et désigne la MEILLEURE des trois (mode, longueur,
préfixe conservé, zéro tiret, zéro jargon). Indique son index (0, 1 ou 2) dans "best".

Rappel : les trois variantes sont en ${langue}.

Réponds UNIQUEMENT en JSON, sans bloc de code ni commentaire :
{"chosen_position": <numéro de slide>, "mode": "instructif|confession", "variants": ["A","B","C"], "best": 0}`;

  // Quatre tentatives avec attente croissante : une réponse mal formée (JSON
  // cassé, position invalide) OU un appel Gemini en échec passager (surcharge)
  // laissait le post SANS placement Sophia, ce qui n'a aucun sens sur un post
  // promotionnel. On enveloppe TOUT l'essai (appel compris) dans le try, et on
  // espace les reprises, pour absorber les pics de surcharge avant d'abandonner.
  for (let essai = 0; essai < 4; essai += 1) {
    if (essai > 0) await new Promise((r) => setTimeout(r, 1500 * essai + Math.random() * 1000));

    try {
      const parts = await callWithFallback(TEXT_MODELS, [{ text: prompt }]);
      const raw = textOf(parts).replace(/^```(?:json)?|```$/g, "").trim();

      const parsed = JSON.parse(raw);
      const chosenPosition = Number(parsed.chosen_position);
      const variants = (parsed.variants ?? [])
        .map((v: unknown) => String(v ?? "").trim())
        .filter(Boolean);

      // La position choisie DOIT être dans les 2-3 dernières slides. Si le modèle
      // sort une position hors zone, on la ramène sur la dernière slide autorisée
      // plutôt que d'échouer (les variantes restent valables pour une slide de fin).
      const positionFinale = autorisees.includes(chosenPosition)
        ? chosenPosition
        : autorisees[autorisees.length - 1];
      if (!positionFinale || variants.length === 0) continue;

      const best = Number(parsed.best);
      const bestIndex = Number.isInteger(best) && best >= 0 && best < variants.length ? best : 0;

      return { chosenPosition: positionFinale, mode: String(parsed.mode ?? ""), variants, bestIndex };
    } catch {
      // appel en échec ou réponse illisible : on retente après l'attente
    }
  }

  return null;
}
