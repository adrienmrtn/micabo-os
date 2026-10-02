/**
 * Plafonds de `navigator.share` et découpage en lots partageables.
 *
 * `navigator.canShare()` ne regarde NI le nombre de fichiers NI leur poids :
 * Chromium n'y teste que la présence des champs et la validité de l'url, puis
 * applique ses plafonds plus tard, dans `share()`, par un rejet
 * « NotAllowedError: Failed to execute 'share' on 'Navigator': Permission
 * denied ». `canShare` ne peut donc pas servir de prédicat de succès, et c'est
 * exactement ce qu'on en faisait : le 29/09 un créateur a vu ce message brut
 * sous le bouton « Save the 12 photos », un autre sur 6 photos, et les deux ont
 * fini par enregistrer leurs slides une par une.
 *
 * Ces deux nombres ne sont dans aucune spec : ils sont codés en dur dans
 * Chromium (`kMaxSharedFileCount`, `kMaxSharedFileBytes`). On les recopie ici
 * parce qu'aucune détection de fonctionnalité ne permet de les découvrir — un
 * `canShare` qui dit oui ne prouve rien. Safari iOS est bien plus large (200+
 * fichiers) ; découper ne lui coûte qu'un lot unique, donc on ne distingue pas
 * les navigateurs.
 *
 * Module pur, sans `navigator` ni DOM : le reste du chemin de téléchargement
 * n'est pas lisible sous Vitest, celui-ci l'est.
 */

/** Chromium : `kMaxSharedFileCount`. Comparaison stricte — 10 pile passe. */
export const MAX_FICHIERS_PARTAGE = 10;

/** Chromium : `kMaxSharedFileBytes`. Comparaison stricte — 50 Mio pile passe. */
export const MAX_OCTETS_PARTAGE = 50 * 1024 * 1024;

/** Tout ce dont le découpage a besoin : ni `File`, ni `Blob`, ni DOM. */
export interface FichierMesurable {
  size: number;
}

/** Ce lot passe-t-il les deux plafonds de Chromium d'un seul coup ? */
export function tientEnUnLot(fichiers: readonly FichierMesurable[]): boolean {
  if (fichiers.length > MAX_FICHIERS_PARTAGE) return false;
  let octets = 0;
  for (const f of fichiers) octets += Math.max(0, f.size) || 0;
  return octets <= MAX_OCTETS_PARTAGE;
}

/**
 * Découpe en lots partageables, dans l'ordre du diaporama.
 *
 * Invariant non négociable, verrouillé par un test : la concaténation des lots
 * EST l'entrée, à l'identique. Un fichier seul au-delà du plafond part dans son
 * propre lot plutôt que d'être écarté — le laisser tomber ferait publier un
 * post amputé d'une slide, et un post amputé vaut moins qu'un échec visible
 * (même arbitrage que le 19/09 : « un post de moins vaut mieux qu'un doublon »).
 * Ce lot-là échouera peut-être au partage, mais le repli ZIP le livrera.
 */
export function decouperEnLots<T extends FichierMesurable>(fichiers: readonly T[]): T[][] {
  const lots: T[][] = [];
  let courant: T[] = [];
  let octets = 0;

  for (const fichier of fichiers) {
    const taille = Math.max(0, fichier.size) || 0;
    const tropNombreux = courant.length >= MAX_FICHIERS_PARTAGE;
    const tropLourd = courant.length > 0 && octets + taille > MAX_OCTETS_PARTAGE;
    if (tropNombreux || tropLourd) {
      lots.push(courant);
      courant = [];
      octets = 0;
    }
    courant.push(fichier);
    octets += taille;
  }
  if (courant.length > 0) lots.push(courant);
  return lots;
}

/** Extensions qu'on sait produire ; tout le reste retombe sur `jpg`. */
const EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

/**
 * Nom du fichier d'un visuel, keyé sur son RANG dans le diaporama et non sur
 * `slide.position`.
 *
 * Deux slides peuvent porter la même position — 0279 l'a vu en prod après une
 * renumérotation de `structure_slides` — et deux `File` de même nom se font
 * écraser par `zip.file()` : une photo disparaissait du ZIP sans un mot, et la
 * recherche par nom du bouton par slide rendait la mauvaise. Le rang est unique
 * par construction.
 *
 * L'extension suit le chemin Storage (`format=origin` garde un PNG en PNG) :
 * les listes d'autorisation Android regardent l'extension autant que le type
 * MIME, donc annoncer `.jpg` sur des octets PNG est un risque gratuit.
 */
export function nomVisuel(postId: string, rang: number, url: string): string {
  return `${postId.slice(0, 8)}-${String(rang).padStart(2, "0")}.${extensionVisuel(url)}`;
}

export function extensionVisuel(url: string): string {
  const chemin = url.split("?")[0] ?? "";
  const ext = (chemin.split("/").pop() ?? "").split(".").pop()?.toLowerCase() ?? "";
  return EXTENSIONS.has(ext) ? ext : "jpg";
}
