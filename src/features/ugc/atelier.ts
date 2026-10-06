/**
 * Atelier AI UGC (0308) — lectures directes des tables (RLS admin) et appels
 * à la fonction `ugc-video`. Rien ici n'est lu par l'assignation.
 */
import { supabase } from "@/lib/supabase/client";
import type { MoteurKling, SegmentTexte } from "./ugcVideo";

export interface UgcModele {
  id: string;
  titre: string;
  source_url: string;
  tiktok_post_id: string | null;
  legende_source: string | null;
  vues_source: number | null;
  musique_url: string | null;
  musique_titre: string | null;
  source_path: string | null;
  source_duree_ms: number | null;
  planche: Array<{ t: number; url: string }>;
  coupe_proposee: { debut_s: number; fin_s: number; demo_debut_s: number | null; raison: string } | null;
  reaction_debut_s: number | null;
  reaction_fin_s: number | null;
  reaction_path: string | null;
  image_ref_path: string | null;
  image_propre_path: string | null;
  textes: SegmentTexte[];
  statut: "a_couper" | "pret" | "archive";
  erreur: string | null;
  created_at: string;
  updated_at: string;
}

export interface UgcRendu {
  id: string;
  modele_id: string;
  persona_id: string;
  moteur: MoteurKling;
  decor: "persona" | "source";
  statut: "en_cours" | "a_valider" | "valide" | "rejete" | "echec";
  etape: "image" | "kling" | "fini";
  image_persona_path: string | null;
  video_media_id: string | null;
  duree_ms: number | null;
  cout_usd: number | null;
  erreur: string | null;
  motif_rejet: string | null;
  created_at: string;
  video: { url: string } | null;
}

export interface UgcDemo {
  id: string;
  titre: string;
  langue: string;
  duree_ms: number | null;
  actif: boolean;
  created_at: string;
  media: { url: string } | null;
}

export interface PersonaAtelier {
  id: string;
  nom: string;
  image_face_url: string;
  image_profile_url: string | null;
}

/** URL publique d'un chemin du bucket `medias`. */
export function urlMedia(chemin: string | null | undefined): string | null {
  if (!chemin) return null;
  return supabase.storage.from("medias").getPublicUrl(chemin).data.publicUrl;
}

async function appeler<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ugc-video", { body });
  if (error) {
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const corps = (await ctx.json()) as { error?: string };
        if (corps?.error) message = corps.error;
      }
    } catch {
      // corps illisible : on garde le message du client
    }
    throw new Error(message);
  }
  const r = data as { error?: string };
  if (r?.error) throw new Error(r.error);
  return data as T;
}

export async function listerModeles(): Promise<UgcModele[]> {
  const { data, error } = await supabase
    .from("ugc_modeles")
    .select("*")
    .neq("statut", "archive")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as UgcModele[];
}

export async function listerRendus(): Promise<UgcRendu[]> {
  const { data, error } = await supabase
    .from("ugc_rendus")
    .select("*, video:media_library!ugc_rendus_video_media_id_fkey(url)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as UgcRendu[];
}

export async function listerDemos(): Promise<UgcDemo[]> {
  const { data, error } = await supabase
    .from("ugc_demos")
    .select("*, media:media_library!ugc_demos_media_id_fkey(url)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as UgcDemo[];
}

export async function listerPersonasAtelier(): Promise<PersonaAtelier[]> {
  const { data, error } = await supabase
    .from("ugc_personas")
    .select("id, nom, image_face_url, image_profile_url")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PersonaAtelier[];
}

export function importerModele(url: string) {
  return appeler<{ ok: true; id: string; deja?: boolean }>({ action: "modele_importer", url });
}

export function couperModele(id: string, debut_s: number, fin_s: number, demo_debut_s: number | null) {
  return appeler<{ ok: true }>({ action: "modele_couper", id, debut_s, fin_s, demo_debut_s });
}

export function enregistrerTextes(id: string, textes: SegmentTexte[]) {
  return appeler<{ ok: true; textes: SegmentTexte[] }>({ action: "modele_textes", id, textes });
}

export async function archiverModele(id: string): Promise<void> {
  const { error } = await supabase.from("ugc_modeles").update({ statut: "archive" }).eq("id", id);
  if (error) throw error;
}

export function lancerRendu(input: {
  modele_id: string;
  persona_id: string;
  moteur: MoteurKling;
  decor: "persona" | "source";
}) {
  return appeler<{ ok: true; id: string }>({ action: "rendu_lancer", ...input });
}

export function suivreRendus() {
  return appeler<{ ok: true; suivis: Array<{ id: string; etat: string }> }>({ action: "rendus_suivre" });
}

export function deciderRendu(id: string, decision: "valide" | "rejete", motif?: string) {
  return appeler<{ ok: true }>({ action: "rendu_decider", id, decision, motif });
}

/** Dépose le MP4 dans le bucket, puis la fonction retire ses métadonnées en place. */
export async function ajouterDemo(fichier: File, langue: string, titre: string) {
  const chemin = `ugc/demos/${crypto.randomUUID()}.mp4`;
  const { error } = await supabase.storage.from("medias").upload(chemin, fichier, {
    contentType: "video/mp4",
    upsert: false,
  });
  if (error) throw error;
  return appeler<{ ok: true }>({ action: "demo_ajouter", chemin, langue, titre });
}

export async function basculerDemo(id: string, actif: boolean): Promise<void> {
  const { error } = await supabase.from("ugc_demos").update({ actif }).eq("id", id);
  if (error) throw error;
}
