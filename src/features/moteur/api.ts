import { supabase } from "@/lib/supabase/client";
import type {
  Compte,
  CompteAvecDetails,
  CompteReference,
  Media,
  Post,
  PostSlide,
  PosterProfil,
  Reglages,
  Sujet,
} from "./types";

/** Date du jour en YYYY-MM-DD, en heure locale — le poster raisonne sur sa
 *  journée, pas sur celle de Greenwich. */
export function aujourdhui(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  const result = data as { error?: string };
  if (result?.error) throw new Error(result.error);
  return data as T;
}

// --- Comptes de référence ---------------------------------------------------

export async function listerSources(): Promise<CompteReference[]> {
  const { data, error } = await supabase
    .from("comptes_reference")
    .select("*")
    .order("handle_tiktok");
  if (error) throw error;
  return data as CompteReference[];
}

export async function creerSource(input: {
  handle: string;
  niche: string;
  langue: string;
}): Promise<void> {
  const { error } = await supabase.from("comptes_reference").insert({
    handle_tiktok: input.handle.trim().replace(/^@/, ""),
    niche: input.niche.trim() || null,
    langue: input.langue,
  });
  if (error) throw error;
}

export async function majSource(id: string, patch: Partial<CompteReference>): Promise<void> {
  const { error } = await supabase.from("comptes_reference").update(patch).eq("id", id);
  if (error) throw error;
}

export async function supprimerSource(id: string): Promise<void> {
  const { error } = await supabase.from("comptes_reference").delete().eq("id", id);
  if (error) throw error;
}

// --- Sujets -----------------------------------------------------------------

export async function listerSujets(): Promise<Sujet[]> {
  const { data, error } = await supabase
    .from("sujets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as Sujet[];
}

// --- Comptes de publication -------------------------------------------------

export async function listerComptes(): Promise<CompteAvecDetails[]> {
  const { data, error } = await supabase
    .from("comptes")
    .select("*, profiles(prenom, nom), comptes_reference(handle_tiktok)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as CompteAvecDetails[];
}

export async function creerCompte(input: {
  posterId: string;
  compteReferenceId: string | null;
  langue: string;
  personaNom: string;
  handleTiktok: string;
}): Promise<void> {
  const { error } = await supabase.from("comptes").insert({
    poster_id: input.posterId,
    compte_reference_id: input.compteReferenceId,
    langue: input.langue,
    persona_nom: input.personaNom.trim() || null,
    handle_tiktok: input.handleTiktok.trim().replace(/^@/, "") || null,
  });
  if (error) throw error;
}

export async function majCompte(id: string, patch: Partial<Compte>): Promise<void> {
  const { error } = await supabase.from("comptes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function supprimerCompte(id: string): Promise<void> {
  const { error } = await supabase.from("comptes").delete().eq("id", id);
  if (error) throw error;
}

// --- Posters ----------------------------------------------------------------

export async function listerPosters(): Promise<PosterProfil[]> {
  const { data: profils, error } = await supabase
    .from("profiles")
    .select("id, prenom, nom, email, langues, is_active, must_change_password")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const { data: roles } = await supabase.from("user_roles").select("user_id, role");
  const parUtilisateur = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

  return (profils ?? []).map((p) => ({
    ...p,
    role: (parUtilisateur.get(p.id) ?? null) as PosterProfil["role"],
  }));
}

export function creerPoster(input: {
  prenom: string;
  nom: string;
  password: string;
}) {
  return invoke<{ userId: string; email: string }>("manage-users", {
    action: "create",
    ...input,
  });
}

export function supprimerPoster(userId: string) {
  return invoke("manage-users", { action: "delete", userId });
}

export async function majPoster(id: string, patch: { is_active?: boolean }): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

// --- Bibliothèque -----------------------------------------------------------

export async function listerMedias(compteReferenceId?: string): Promise<Media[]> {
  let query = supabase
    .from("media_library")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (compteReferenceId) query = query.eq("compte_reference_id", compteReferenceId);

  const { data, error } = await query;
  if (error) throw error;
  return data as Media[];
}

// --- Posts ------------------------------------------------------------------

export async function listerPosts(compteId?: string): Promise<Post[]> {
  let query = supabase
    .from("posts")
    .select("*")
    .order("date_publication_prevue", { ascending: false, nullsFirst: false })
    .limit(200);
  if (compteId) query = query.eq("compte_id", compteId);

  const { data, error } = await query;
  if (error) throw error;
  return data as Post[];
}

export async function lirePost(id: string): Promise<Post | null> {
  const { data } = await supabase.from("posts").select("*").eq("id", id).single();
  return (data as Post) ?? null;
}

export async function listerSlides(postId: string): Promise<PostSlide[]> {
  const { data, error } = await supabase
    .from("post_slides")
    .select("*, media_library(url)")
    .eq("post_id", postId)
    .order("position");
  if (error) throw error;
  return data as PostSlide[];
}

/** Réordonne en réécrivant les positions ; l'ordre visuel du poster fait foi. */
export async function reordonnerSlides(slides: PostSlide[]): Promise<void> {
  for (const [index, slide] of slides.entries()) {
    const { error } = await supabase
      .from("post_slides")
      .update({ position: index + 1 })
      .eq("id", slide.id);
    if (error) throw error;
  }
}

export async function majPost(id: string, patch: Partial<Post>): Promise<void> {
  const { error } = await supabase.from("posts").update(patch).eq("id", id);
  if (error) throw error;
}

// --- Réglages et prompts ----------------------------------------------------

export async function lireReglages(): Promise<Reglages> {
  const { data, error } = await supabase.from("reglages").select("cle, valeur");
  if (error) throw error;
  const map = new Map((data ?? []).map((r) => [r.cle, r.valeur]));

  return {
    repartition: map.get("repartition") ?? { recycle: 60, remanie: 20, nouveau: 20 },
    frequence: map.get("frequence") ?? { posts_par_jour: 2 },
    semaine1: map.get("semaine1") ?? {
      actif: true,
      jours: 7,
      posts_par_jour: 2,
      tout_recycle: true,
    },
  };
}

export async function ecrireReglage(cle: string, valeur: unknown): Promise<void> {
  const { error } = await supabase
    .from("reglages")
    .upsert({ cle, valeur, updated_at: new Date().toISOString() }, { onConflict: "cle" });
  if (error) throw error;
}

export async function lirePrompt(cle: string): Promise<string> {
  const { data } = await supabase
    .from("prompts")
    .select("contenu")
    .eq("cle", cle)
    .maybeSingle();
  return data?.contenu ?? "";
}

export async function ecrirePrompt(cle: string, contenu: string): Promise<void> {
  const { error } = await supabase
    .from("prompts")
    .upsert({ cle, contenu, updated_at: new Date().toISOString() }, { onConflict: "cle" });
  if (error) throw error;
}

// --- Moteur -----------------------------------------------------------------

export const lancerExtraction = (compteReferenceId?: string) =>
  invoke<{ sujetsCrees: number }>("extraction", { compteReferenceId: compteReferenceId ?? null });

export const lancerPreparation = (sujetId?: string) =>
  invoke<{ etape?: string; idle?: boolean }>("preparation", { sujetId: sujetId ?? null });

export const lancerAssignation = (compteId?: string) =>
  invoke<{ resultats: Array<{ compteId: string; crees: number }> }>("assignation", {
    compteId: compteId ?? null,
  });

export const lancerComposition = (input: {
  compteId: string;
  sujetId: string;
  type?: string;
  date?: string;
}) => invoke<{ postId: string }>("composition", input);
