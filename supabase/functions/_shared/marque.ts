/**
 * Règles de texte qui ne demandent pas de LLM — et qui, jusqu'ici, n'étaient
 * appliquées nulle part sur les decks en LANGUE SOURCE.
 *
 * `assurerDeckPourLangue` sortait directement quand la langue du compte est
 * celle du slideshow : `deck = deckSource`. Or `translateSlideshow` est le seul
 * endroit où vivaient la casse de la marque, l'interdiction du tiret long et la
 * génération des hashtags. Un deck publié dans sa propre langue ne voyait donc
 * aucune de ces règles. Au 17/09/2026 c'était 133 decks sur 206 (65 %), et les
 * 14 fautes de marque relevées en base étaient TOUTES dans ce groupe, zéro dans
 * les traduits — la corrélation était exacte.
 *
 * Ces fonctions sont PURES et sans appel réseau : elles peuvent donc tourner sur
 * le chemin source, qu'on ne veut surtout pas faire repasser par un modèle. Le
 * texte source performe mieux que le traduit (médiane 4 540 vues contre 1 386 au
 * 17/09) ; on le corrige, on ne le réécrit pas.
 */

/** Le mot de catégorie devant la marque, par langue (0267). */
const ARTICLE: Record<string, string> = {
  fr: "l'appli micabo",
  en: "the micabo app",
  es: "la app micabo",
  de: "die micabo-App",
  it: "l'app micabo",
  pt: "a app micabo",
  nl: "de micabo-app",
  pl: "aplikacja micabo",
  ro: "aplicația micabo",
  cs: "aplikace micabo",
  sv: "micabo-appen",
  hu: "a micabo alkalmazás",
  el: "η εφαρμογή micabo",
};

/** Formes turques : le cas se pose sur le POSSESSIF, jamais sur le nom. */
const SUFFIXES_TR: Array<[RegExp, string]> = [
  [/[Mm]icabo['’]ya/g, "micabo uygulamasına"],
  [/[Mm]icabo['’]yu/g, "micabo uygulamasını"],
  [/[Mm]icabo['’]dan/g, "micabo uygulamasından"],
  [/[Mm]icabo['’]da/g, "micabo uygulamasında"],
];

const MARQUE = /[Mm][Ii][Cc][Aa][Bb][Oo]/g;

/** La slide dit déjà que c'est une application : ne rien doubler. */
function dejaQualifie(texte: string, langue: string): boolean {
  if (langue === "tr") return /uygulama/i.test(texte);
  if (langue === "es") return /\b(app|aplicaci[oó]n)\b/i.test(texte);
  if (langue === "en") return /\bapps?\b/i.test(texte);
  return /\bapp(li|lication)?s?\b/i.test(texte);
}

/**
 * « micabo » en minuscules, précédé de son mot de catégorie.
 *
 * Miroir exact de la fonction SQL `micabo_avec_article` (0267) : le SQL a servi
 * à reprendre le stock existant, celui-ci tient la production courante. Les deux
 * doivent rester d'accord.
 */
export function normaliserMarque(texte: string, langue: string): string {
  if (!texte || !/[Mm][Ii][Cc][Aa][Bb][Oo]/.test(texte)) return texte;

  // La casse d'abord : elle s'applique même quand la catégorie est déjà là.
  const bas = texte.replace(MARQUE, "micabo");
  if (dejaQualifie(bas, langue)) return bas;

  if (langue === "tr") {
    let out = bas;
    for (const [re, par] of SUFFIXES_TR) out = out.replace(re, par);
    // Objet défini d'un « kullan- » : accusatif. Le garde `(?!\s*uygulama)` est
    // indispensable, sinon la règle remord sur la sortie des suffixes ci-dessus
    // et produit « micabo uygulamasını uygulamasını kullan ».
    out = out.replace(/micabo(?!['’]|\s*uygulama)(?=(\s+\S+){0,2}\s+kullan)/g, "micabo uygulamasını");
    return out.replace(/micabo(?!['’]|\s*uygulama)/g, "micabo uygulaması");
  }

  const forme = ARTICLE[langue];
  if (!forme) return bas; // Langue sans forme connue : on garde au moins la casse.

  if (langue === "en") {
    // En tête de ligne ou d'item numéroté, l'article alourdit un titre :
    // « 4. MICABO (AI Tool) » doit donner « 4. micabo app », pas « 4. the micabo app ».
    return bas
      .replace(/(^|\n)(\s*\d+[.)]\s*)?micabo/g, "$1$2micabo app")
      .replace(/micabo(?! app)/g, forme);
  }
  return bas.replace(/micabo/g, forme);
}

/**
 * Le tiret long et le demi-cadratin trahissent un texte d'IA : les règles de
 * traduction les interdisent depuis toujours, mais rien ne les retirait du texte
 * source. Au 17/09 ils étaient dans 10 decks anglais sur 86.
 *
 * Entre deux chiffres c'est un intervalle (« 3–4h ») : on rend un trait d'union.
 * Ailleurs c'est une incise : une virgule fait le même travail sans le signal.
 */
export function retirerTiretsLongs(texte: string): string {
  if (!texte) return texte;
  return texte
    .replace(/(\d)\s*[—–]\s*(\d)/g, "$1-$2")
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/[—–]/g, ", ")
    .replace(/ ,/g, ",")
    .replace(/,\s*,/g, ",");
}

/** Les deux passes, dans l'ordre : c'est ce qu'on applique à un deck source. */
export function nettoyerTexteDeck(texte: string, langue: string): string {
  return normaliserMarque(retirerTiretsLongs(texte), langue);
}
