import { serviceClient } from "./supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

/** Un visuel utilisable comme photo de profil (comptage d'usage inclus). */
export interface VisuelAvatar {
  id: string;
  url: string;
  used_count: number;
}

/**
 * Choisit une photo de profil : n'importe quelle image NETTOYÉE de la source (ou
 * globale), INSTANTANÉMENT — plus de détection de visage par Gemini à la création
 * (c'était le vrai goulot : jusqu'à 6 appels ~2 s = identité qui traîne). On
 * privilégie une image déjà jugée sans visage si dispo, sinon n'importe quelle
 * photo nettoyée fait l'affaire. On évite les avatars déjà attribués à un autre
 * compte (sinon deux posters partagent la même photo). La maintenance peut
 * affiner « sans visage » plus tard, hors du chemin critique.
 */
export async function choisirVisuelSansVisage(
  supabase: Supabase,
  compteReferenceId: string | null,
): Promise<VisuelAvatar | null> {
  const { data: dejaAvatars } = await supabase
    .from("comptes")
    .select("avatar_url")
    .not("avatar_url", "is", null);
  const pris = new Set((dejaAvatars ?? []).map((c) => c.avatar_url as string));
  const premierLibre = (medias: VisuelAvatar[] | null) =>
    (medias ?? []).find((m) => !pris.has(m.url)) ?? null;

  // Une seule requête (pas d'appel Gemini). `sansVisageDabord` place les images
  // déjà jugées sans visage en tête, mais n'exclut PAS les autres.
  const chercher = async (limiterALaSource: boolean) => {
    let q = supabase
      .from("media_library")
      .select("id, url, used_count")
      .eq("texte_restant", false)
      .like("storage_path", "propre/%")
      // false (sans visage) avant null (non jugé) avant true — nulls en dernier.
      .order("visage_identifiable", { ascending: true, nullsFirst: false })
      .order("used_count")
      .limit(80);
    if (limiterALaSource && compteReferenceId) q = q.eq("compte_reference_id", compteReferenceId);
    const { data } = await q;
    return premierLibre(data);
  };

  return (compteReferenceId ? await chercher(true) : null) ?? (await chercher(false));
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
