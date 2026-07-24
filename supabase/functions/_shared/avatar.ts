import { contientVisageIdentifiable } from "./gemini.ts";
import { serviceClient } from "./supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

/** Un visuel utilisable comme photo de profil (comptage d'usage inclus). */
export interface VisuelAvatar {
  id: string;
  url: string;
  used_count: number;
}

// Combien de visuels encore non examinés on juge par appel, quand aucun n'a
// déjà été validé « sans visage ».
const CANDIDATS_AVATAR = 6;

/**
 * Trouve un visuel SANS VISAGE identifiable pour servir de photo de profil.
 *
 * Le test de visage se paie à l'appel Gemini : on privilégie donc les visuels
 * DÉJÀ jugés sans visage (aucun appel), et on ne juge de nouveaux candidats
 * qu'en dernier recours — en gardant le verdict pour ne pas le repayer. On tente
 * d'abord la source du compte, puis TOUTE la bibliothèque : un avatar est juste
 * une photo esthétique sans visage, la niche exacte importe peu, et ça garantit
 * un avatar même quand une source neuve n'a encore aucune image à elle.
 */
export async function choisirVisuelSansVisage(
  supabase: Supabase,
  compteReferenceId: string | null,
): Promise<VisuelAvatar | null> {
  const connuSansVisage = async (limiterALaSource: boolean) => {
    let q = supabase
      .from("media_library")
      .select("id, url, used_count")
      .eq("visage_identifiable", false)
      .eq("texte_restant", false)
      .like("storage_path", "propre/%")
      .order("used_count")
      .limit(1);
    if (limiterALaSource && compteReferenceId) q = q.eq("compte_reference_id", compteReferenceId);
    const { data } = await q;
    return data?.[0] ?? null;
  };

  const dejaSur =
    (compteReferenceId ? await connuSansVisage(true) : null) ?? (await connuSansVisage(false));
  if (dejaSur) return dejaSur;

  const jugerNouveaux = async (limiterALaSource: boolean) => {
    let q = supabase
      .from("media_library")
      .select("id, url, used_count")
      .is("visage_identifiable", null)
      .eq("texte_restant", false)
      .like("storage_path", "propre/%")
      .order("used_count")
      .limit(CANDIDATS_AVATAR);
    if (limiterALaSource && compteReferenceId) q = q.eq("compte_reference_id", compteReferenceId);
    const { data: candidats } = await q;

    for (const media of candidats ?? []) {
      const visage = await contientVisageIdentifiable(media.url);
      await supabase
        .from("media_library")
        .update({ visage_identifiable: visage === null ? true : visage })
        .eq("id", media.id);
      if (visage === false) return media;
    }
    return null;
  };

  return (
    (compteReferenceId ? await jugerNouveaux(true) : null) ?? (await jugerNouveaux(false))
  );
}

/**
 * Photo de profil À COPIER pour un poster de cette source : l'avatar PRÉPARÉ à
 * l'avance sur le compte de référence (aucun appel), sinon on en choisit un à la
 * volée. Renvoie null seulement si vraiment aucune image sans visage n'existe.
 */
export async function avatarPourSource(
  supabase: Supabase,
  compteReferenceId: string | null,
): Promise<VisuelAvatar | null> {
  if (compteReferenceId) {
    const { data: ref } = await supabase
      .from("comptes_reference")
      .select("avatar_url, avatar_media_id")
      .eq("id", compteReferenceId)
      .maybeSingle();
    if (ref?.avatar_url) {
      return { id: ref.avatar_media_id ?? "", url: ref.avatar_url, used_count: 0 };
    }
  }
  return choisirVisuelSansVisage(supabase, compteReferenceId);
}

/**
 * PRÉPARE (à l'avance, la nuit) la photo de profil d'un compte de référence :
 * choisit un visuel sans visage et le mémorise sur la source. À la création d'un
 * poster, il n'y a plus qu'à le copier — zéro appel, zéro attente. Renvoie l'URL
 * préparée, ou null si la source n'a encore aucune image exploitable.
 */
export async function preparerAvatarReference(
  supabase: Supabase,
  referenceId: string,
): Promise<string | null> {
  const visuel = await choisirVisuelSansVisage(supabase, referenceId);
  if (!visuel) return null;
  await supabase
    .from("comptes_reference")
    .update({ avatar_url: visuel.url, avatar_media_id: visuel.id || null })
    .eq("id", referenceId);
  return visuel.url;
}
