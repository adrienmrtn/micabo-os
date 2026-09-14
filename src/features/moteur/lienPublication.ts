/**
 * Le lien TikTok que colle un créateur pour marquer un post publié.
 *
 * L'OS n'exigeait que « non vide ». Le 14/09/2026, après avoir rebâti le
 * relevé des stats, 7 passages sur 11 restaient impossibles à mesurer — non
 * parce que le scrape ratait, mais parce que `publie_url` ne contenait pas un
 * lien de post :
 *
 *   - « #methodetude #revisions #etudiant »  → la légende, collée au lieu du lien
 *   - « tiktok.com/@ines.notes510?_r=1… »    → le lien du PROFIL
 *   - « tiktok.com/@gyael88 »                → le profil de quelqu'un d'autre
 *
 * `idDuLien` (moteur) cherche `/photo/<id>` ou `/video/<id>` et retombe sur
 * l'URL entière quand il n'y en a pas : le rapprochement ne peut alors jamais
 * aboutir, et le passage reste à zéro vue pour toujours. Aucun correctif de
 * scrape ne rattrape ça — il faut refuser la saisie.
 *
 * Module pur : la même règle vaut pour le créateur (message inline) et pour
 * l'admin (garde dans `majPost` / `majPassage`).
 */

export type MotifLienInvalide =
  | "vide"
  | "pas_une_url"
  | "pas_tiktok"
  | "profil_sans_post";

export interface LienVerdict {
  ok: boolean;
  motif?: MotifLienInvalide;
  /** URL nettoyée (espaces retirés) quand elle est valide. */
  url?: string;
}

/** Liens courts de partage : l'id du post n'apparaît qu'après redirection. */
const HOTES_COURTS = /^(?:vm|vt)\.tiktok\.com$/i;
const HOTES_TIKTOK = /(?:^|\.)tiktok\.com$/i;

/** `/photo/<id>` ou `/video/<id>` — ce que le moteur sait rapprocher. */
const CHEMIN_POST = /\/(?:photo|video)\/\d+/;

export function verifierLienPublication(brut: string): LienVerdict {
  const texte = (brut ?? "").trim();
  if (!texte) return { ok: false, motif: "vide" };

  let url: URL;
  try {
    url = new URL(texte.startsWith("http") ? texte : `https://${texte}`);
  } catch {
    return { ok: false, motif: "pas_une_url" };
  }

  if (!HOTES_TIKTOK.test(url.hostname)) {
    return { ok: false, motif: "pas_tiktok" };
  }

  // Un lien court ne porte pas encore l'id : `resoudreLien` le déroulera au
  // relevé. On l'accepte tel quel — le refuser bloquerait le geste le plus
  // naturel du créateur (le bouton « Partager » de TikTok).
  if (HOTES_COURTS.test(url.hostname)) {
    return url.pathname.replace(/\/+$/, "").length > 1
      ? { ok: true, url: url.toString() }
      : { ok: false, motif: "profil_sans_post" };
  }

  if (!CHEMIN_POST.test(url.pathname)) {
    return { ok: false, motif: "profil_sans_post" };
  }

  return { ok: true, url: url.toString() };
}

export function lienPublicationValide(brut: string): boolean {
  return verifierLienPublication(brut).ok;
}
