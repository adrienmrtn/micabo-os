import { supabase } from "@/lib/supabase/client";

/**
 * La vidéo du jour d'un compte AI UGC (0310), côté créateur.
 *
 * Un compte vidéo est un compte créateur classique qui reçoit UNE vidéo par
 * jour au lieu de slideshows : la vidéo complète (la réaction refaite par le
 * persona), une démo de l'appli quand la source en a une, le texte à coller
 * dans TikTok et la capture de la vidéo d'origine qui montre où le poser.
 * Le créateur ne lit que les publications de ses comptes (RLS) et n'écrit que
 * par `ugc_publication_marquer`.
 */
export interface PublicationUgc {
  id: string;
  compte_id: string;
  date_publication_prevue: string;
  video_url: string;
  demo_url: string | null;
  texte: string;
  capture_url: string | null;
  legende: string;
  musique_url: string | null;
  statut: "assigne" | "publie" | "annule";
  publie_at: string | null;
  publie_url: string | null;
}

const COLONNES =
  "id, compte_id, date_publication_prevue, video_url, demo_url, texte, capture_url, legende, musique_url, statut, publie_at, publie_url";

/** Les vidéos des comptes du créateur connecté, les plus récentes d'abord. */
export async function mesPublicationsUgc(): Promise<PublicationUgc[]> {
  const { data, error } = await supabase
    .from("ugc_publications")
    .select(COLONNES)
    .neq("statut", "annule")
    .order("date_publication_prevue", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as PublicationUgc[];
}

export async function lirePublicationUgc(id: string): Promise<PublicationUgc | null> {
  const { data, error } = await supabase
    .from("ugc_publications")
    .select(COLONNES)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicationUgc | null) ?? null;
}

/**
 * Publiée avec son lien TikTok, ou remise à faire (`url` nul). La fonction ne
 * rend rien quand elle refuse (pas au créateur, annulée, lien hors TikTok) :
 * un refus silencieux se lirait comme un succès, donc il lève.
 */
export async function marquerPublicationUgc(
  id: string,
  url: string | null,
): Promise<PublicationUgc> {
  const { data, error } = await supabase.rpc("ugc_publication_marquer", {
    p_id: id,
    p_url: url,
  });
  if (error) throw error;
  const ligne = (Array.isArray(data) ? data[0] : data) as PublicationUgc | undefined;
  if (!ligne) throw new Error("Publication refusée");
  return ligne;
}

/** Nom du fichier enregistré : le compte et le jour, pour s'y retrouver. */
export function nomFichierVideo(
  handle: string | null | undefined,
  jour: string,
  genre: "video" | "demo",
): string {
  const base = (handle ?? "").replace(/^@+/, "").replace(/[^\w.-]+/g, "") || "micabo";
  return `${base}-${jour}${genre === "demo" ? "-demo" : ""}.mp4`;
}

/** Une entrée du calendrier du créateur, slideshow ou vidéo. */
export interface EntreeCalendrierUgc {
  id: string;
  compte_id: string | null;
  date_publication_prevue: string | null;
  type: string;
  statut: string;
  persona_nom: string | null;
  handle_tiktok: string | null;
  sujet_titre: string | null;
  publie_at: string | null;
  /** La page à ouvrir : `/ugc/<id>` pour une vidéo. */
  lien: string;
}

/**
 * Une vidéo dans le calendrier, au même format qu'un post : la grille, le
 * bloc « Aujourd'hui » et les retards (`postsDuJour`) la traitent comme les
 * autres. Seul le lien change.
 */
export function entreeCalendrierUgc(pub: PublicationUgc, titre: string): EntreeCalendrierUgc {
  return {
    id: pub.id,
    compte_id: pub.compte_id,
    date_publication_prevue: pub.date_publication_prevue,
    type: "video",
    statut: pub.statut,
    persona_nom: null,
    handle_tiktok: null,
    sujet_titre: titre,
    publie_at: pub.publie_at,
    lien: `/ugc/${pub.id}`,
  };
}
