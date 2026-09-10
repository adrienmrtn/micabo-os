/**
 * Reconnaître une slide dont le nettoyage a échoué.
 *
 * Le piège : un échec ne laisse presque jamais de trace visible dans
 * `structure_slides`. Quand `nettoyerSlide` rend les armes, l'import ne laisse
 * pas la slide vide — il lui donne un visuel de secours (`tenterRemplacementLabel`,
 * pioché dans la biblio du label) ou retombe sur le brut (`stockerBrut`), puis
 * `patchSlideMediaId(..., p_clear_tentatives: true)` remet le compteur à zéro.
 * La slide finit donc avec un `media_id` valide et zéro tentative : chercher
 * « media_id null ou tentatives épuisées » ne trouve que les échecs encore en
 * vol, jamais ceux que le pipeline a déjà maquillés.
 *
 * Mesuré en prod le 10/09/2026 : 855 slides nettoyées pour de vrai, et
 * **113 slides substituées sur 78 slideshows** — invisibles pour l'ancien test.
 *
 * Le signal fiable est `media_library.contenu_id` : le nettoyage d'une slide
 * écrit un média rattaché à SON contenu. Un média venu d'ailleurs est un
 * secours, donc un échec. On préfère ce champ au `storage_path` parce qu'un
 * nettoyage manuel (`nettoyer-media`) réécrit le chemin en `propre/manuel/…`
 * sans changer de contenu : le test sur le chemin le prendrait pour un emprunt.
 */

import { MAX_TENTATIVES_NETTOYAGE, tentativesSlide } from "@/features/moteur/nettoyageFile";

export type MotifEchecNettoyage =
  | "sans_media"
  | "tentatives_epuisees"
  | "media_introuvable"
  | "substitue"
  | "texte_restant";

export interface SlideANettoyer {
  contenuId: string;
  position: number;
  mediaId: string | null;
  tentatives?: number;
  /** Le brut TikTok est la source du re-nettoyage : sans lui, rien à rejouer. */
  aSource: boolean;
  /** Slideshow monté à la main : ses visuels viennent de la biblio par design. */
  creationManuelle?: boolean;
  /** `null` = référence morte (média supprimé). */
  media: { contenuId: string | null; texteRestant: boolean } | null;
}

/**
 * Pourquoi cette slide est à re-nettoyer, ou `null` si tout va bien.
 *
 * L'ordre des tests va du plus franc au plus discret : une slide sans média
 * n'a rien, une slide substituée a quelque chose — mais pas son image.
 */
export function motifEchecNettoyage(slide: SlideANettoyer): MotifEchecNettoyage | null {
  // Sans brut source, un re-nettoyage n'a rien à se mettre sous la dent.
  if (!slide.aSource) return null;
  // Un slideshow manuel n'a pas d'image « à lui » : la biblio est la règle,
  // pas le symptôme d'un échec.
  if (slide.creationManuelle) return null;

  if (!slide.mediaId) return "sans_media";
  const tentatives = tentativesSlide({
    position: slide.position,
    media_id: slide.mediaId,
    tentatives: slide.tentatives,
  });
  if (tentatives >= MAX_TENTATIVES_NETTOYAGE) return "tentatives_epuisees";
  if (!slide.media) return "media_introuvable";
  // Repli brut : le média porte encore le texte d'origine.
  if (slide.media.texteRestant) return "texte_restant";
  // Secours biblio : le visuel appartient à un autre slideshow.
  if (slide.media.contenuId !== slide.contenuId) return "substitue";
  return null;
}

/** Compte les slides par motif — sert à annoncer ce qu'on s'apprête à rejouer. */
export function resumerMotifs(
  motifs: MotifEchecNettoyage[],
): Partial<Record<MotifEchecNettoyage, number>> {
  const par: Partial<Record<MotifEchecNettoyage, number>> = {};
  for (const m of motifs) par[m] = (par[m] ?? 0) + 1;
  return par;
}
