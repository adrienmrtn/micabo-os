import { supabase } from "@/lib/supabase/client";
import { LANGUES_CIBLES } from "@/features/moteur/langues";
import type { Role } from "@/features/auth/AuthContext";
import type {
  Compte,
  StatsCompte,
  StatsPost,
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
  if (error) {
    // Sur une réponse non-2xx, supabase renvoie un message générique
    // (« Edge Function returned a non-2xx status code ») : on va lire le vrai
    // message dans le corps de la réponse pour l'afficher tel quel.
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const corps = await ctx.json();
        if (corps?.error) message = corps.error as string;
      }
    } catch {
      // corps illisible : on garde le message générique
    }
    throw new Error(message);
  }
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
    .select("*, profiles(prenom, nom, upwork_url), comptes_reference(handle_tiktok)")
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
    .select(
      "id, prenom, nom, email, langues, nationalite, upwork_url, manager_id, is_active, must_change_password, cout_mensuel",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const { data: roles } = await supabase.from("user_roles").select("user_id, role");
  const parUtilisateur = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

  // Le pseudo TikTok du poster vit sur son compte de publication ; on rapatrie
  // aussi son compte de RÉFÉRENCE (la source), visible côté admin seulement.
  const { data: comptes } = await supabase
    .from("comptes")
    .select("poster_id, handle_tiktok, comptes_reference(handle_tiktok)");
  const handleParPoster = new Map(
    (comptes ?? []).filter((c) => c.handle_tiktok).map((c) => [c.poster_id, c.handle_tiktok]),
  );
  const referenceParPoster = new Map<string, string>();
  for (const c of comptes ?? []) {
    const ref = (c as { comptes_reference?: { handle_tiktok?: string } }).comptes_reference;
    if (ref?.handle_tiktok) referenceParPoster.set(c.poster_id, ref.handle_tiktok);
  }

  const nomParId = new Map(
    (profils ?? []).map((p) => [
      p.id,
      [p.prenom, p.nom].filter(Boolean).join(" ") || p.email || "—",
    ]),
  );

  return (profils ?? []).map((p) => ({
    ...p,
    role: (parUtilisateur.get(p.id) ?? null) as PosterProfil["role"],
    handle_tiktok: handleParPoster.get(p.id) ?? null,
    reference_handle: referenceParPoster.get(p.id) ?? null,
    manager_nom: p.manager_id ? (nomParId.get(p.manager_id) ?? null) : null,
  }));
}

// --- Reviews -----------------------------------------------------------------

export interface Review {
  id: string;
  poster_id: string;
  body: string;
  note: number | null;
  created_at: string;
  seen_at: string | null;
}

/** L'admin envoie une review (retour) à un poster : elle s'affichera en pop-up
 *  à sa prochaine connexion. */
export async function envoyerReview(posterId: string, body: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("reviews")
    .insert({ poster_id: posterId, body: body.trim(), admin_id: auth.user?.id ?? null });
  if (error) throw error;
}

/** Toutes les reviews (admin), les plus récentes d'abord. */
export async function listerReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, poster_id, body, note, created_at, seen_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as Review[];
}

/** Reviews non encore vues du poster connecté (RLS ne renvoie que les siennes). */
export async function mesReviewsNonVues(): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, poster_id, body, note, created_at, seen_at")
    .is("seen_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Review[];
}

/** Le poster marque une review comme vue (referme le pop-up). */
export async function marquerReviewVue(id: string): Promise<void> {
  const { error } = await supabase
    .from("reviews")
    .update({ seen_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Crée directement un recruteur (hiring manager) par son nom + sa langue
 *  (admin). Son espace est prêt à sa première connexion. */
export function creerRecruteur(input: { prenom: string; nom: string; langue?: string }) {
  return invoke<{ userId: string; email: string }>("manage-users", {
    action: "create",
    role: "hiring_manager",
    prenom: input.prenom,
    nom: input.nom,
    password: "12345678",
    langue: input.langue,
  });
}

/** Enregistre le lien de la conversation Upwork d'un poster (admin). */
export async function majUpwork(userId: string, url: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ upwork_url: url.trim() || null })
    .eq("id", userId);
  if (error) throw error;
}

/** Coût mensuel (€) d'un créateur/recruteur, saisi par l'admin (null = vide). */
export async function majCoutMensuel(userId: string, montant: number | null): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ cout_mensuel: montant })
    .eq("id", userId);
  if (error) throw error;
}

export interface MonCompte {
  persona_nom: string | null;
  persona_bio: string | null;
  handle_tiktok: string | null;
  avatar_url: string | null;
  langue: string;
}

/** Le compte de publication du poster connecté : son identité TikTok (pseudo,
 *  bio, avatar), générée automatiquement à la création. La RLS ne renvoie que
 *  sa propre ligne. */
export async function monCompte(): Promise<MonCompte | null> {
  const { data, error } = await supabase
    .from("comptes")
    .select("persona_nom, persona_bio, handle_tiktok, avatar_url, langue")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as MonCompte) ?? null;
}

/** Le poster met à jour son pseudo TikTok (après avoir créé son compte). */
export async function majMonHandle(handle: string): Promise<void> {
  const { error } = await supabase.rpc("maj_mon_handle", { nouveau: handle });
  if (error) throw error;
}

/** Le poster met à jour SON lien de conversation Upwork depuis son espace. */
export async function majMonUpwork(url: string): Promise<void> {
  const { error } = await supabase.rpc("maj_mon_upwork", { nouveau: url });
  if (error) throw error;
}

/** Le lien Upwork du poster connecté (sur sa propre ligne profiles). */
export async function monUpwork(): Promise<string | null> {
  const { data: sess } = await supabase.auth.getUser();
  const uid = sess.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("upwork_url")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return (data?.upwork_url as string | null) ?? null;
}

export function creerPoster(input: {
  prenom: string;
  nom: string;
  password: string;
  langue?: string;
}) {
  return invoke<{
    userId: string;
    email: string;
    compte: { id: string; reference: string | null; persona: boolean } | null;
  }>("manage-users", {
    action: "create",
    ...input,
  });
}

/** Langues distinctes des comptes de référence actifs (pour le hiring manager
 *  et l'admin : on ne propose que des langues qui ont de la matière). */
/** Langues proposées pour un poster = langues CIBLES supportées (ce dans quoi il
 *  publie), pas les langues des comptes sources. Un slideshow source stocké est
 *  re-traduit vers n'importe laquelle de ces langues. */
export async function listerLanguesReference(): Promise<string[]> {
  return [...LANGUES_CIBLES];
}

/** Définit LE rôle d'un utilisateur (admin uniquement, via RLS). On remplace :
 *  un utilisateur a un seul rôle à la fois dans notre modèle. La `nationalite`,
 *  quand elle est fournie (promotion en recruteur), sert de langue par défaut à
 *  la création de posters. */
export async function definirRole(
  userId: string,
  role: Role,
  nationalite?: string,
): Promise<void> {
  const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
  if (delErr) throw delErr;
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
  if (nationalite !== undefined) {
    const { error: natErr } = await supabase
      .from("profiles")
      .update({ nationalite: nationalite || null })
      .eq("id", userId);
    if (natErr) throw natErr;
  }
}

export interface SlideApercu {
  position: number;
  texte_original: string | null;
  url_propre: string | null;
  url_brute: string | null;
}

/** Les slides d'un sujet DANS L'ORDRE, avec l'image nettoyée + l'image d'origine
 *  (avec texte) + le texte : c'est le slideshow stocké, prêt à re-traduire. */
export async function apercuSujet(sujetId: string): Promise<SlideApercu[]> {
  const { data: sujet, error } = await supabase
    .from("sujets")
    .select("structure_slides")
    .eq("id", sujetId)
    .single();
  if (error) throw error;
  const slides = (sujet?.structure_slides ?? []) as Array<{
    position: number;
    texte_original: string | null;
    raw_url: string | null;
    media_id: string | null;
  }>;

  const mediaIds = slides.map((s) => s.media_id).filter(Boolean) as string[];
  const urlParMedia = new Map<string, string>();
  if (mediaIds.length > 0) {
    const { data: medias } = await supabase
      .from("media_library")
      .select("id, url")
      .in("id", mediaIds);
    for (const m of medias ?? []) urlParMedia.set(m.id as string, m.url as string);
  }

  return slides
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      position: s.position,
      texte_original: s.texte_original,
      url_propre: s.media_id ? urlParMedia.get(s.media_id) ?? null : null,
      url_brute: s.raw_url ?? null,
    }));
}

// --- Documents (guides, FAQ) -------------------------------------------------

export interface DocumentEditable {
  id: string;
  cle: string;
  titre: string;
  contenu: string;
  audience: "manager" | "poster" | "all";
  ordre: number;
  updated_at: string;
}

/** Documents visibles par l'appelant (RLS : admin tout, manager/poster les leurs). */
export async function listerDocuments(): Promise<DocumentEditable[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("audience")
    .order("ordre");
  if (error) throw error;
  return (data ?? []) as DocumentEditable[];
}

export async function lireDocument(cle: string): Promise<DocumentEditable | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("cle", cle)
    .maybeSingle();
  if (error) throw error;
  return (data as DocumentEditable) ?? null;
}

/** Édition d'un document (admin uniquement via RLS). */
export async function majDocument(
  id: string,
  patch: { titre?: string; contenu?: string },
): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
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
  // La bibliothèque ne montre QUE les photos nettoyées (propre/) : une image à
  // texte n'est pas un visuel utilisable, elle n'a rien à y faire. Les brut
  // restent en base pour le banc de test et comme source de nettoyage, mais pas
  // ici. C'est aussi ce qui garantit qu'un remplacement pioche une photo propre.
  let query = supabase
    .from("media_library")
    .select("*")
    .like("storage_path", "propre/%")
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
    // storage_path distingue une photo nettoyée (`propre/…`) d'un original
    // gardé faute de nettoyage (`brut/…`), qui porte encore son texte.
    .select("*, media_library(url, storage_path)")
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

// --- Analyse ----------------------------------------------------------------

export async function statsComptes(): Promise<StatsCompte[]> {
  const { data, error } = await supabase
    .from("stats_comptes")
    .select("*")
    .order("vues_totales", { ascending: false });
  if (error) throw error;
  return data as StatsCompte[];
}

export async function statsPosts(compteId?: string): Promise<StatsPost[]> {
  let query = supabase
    .from("stats_posts")
    .select("*")
    .order("vues", { ascending: false, nullsFirst: false })
    .limit(100);
  if (compteId) query = query.eq("compte_id", compteId);

  const { data, error } = await query;
  if (error) throw error;
  return data as StatsPost[];
}

/** Réassignation manuelle : change le compte destinataire et/ou la date. */
export async function reassignerPost(
  id: string,
  patch: { compte_id?: string; date_publication_prevue?: string | null },
): Promise<void> {
  const { error } = await supabase.from("posts").update(patch).eq("id", id);
  if (error) throw error;
}

export interface PostCalendrierAdmin {
  id: string;
  compte_id: string;
  date_publication_prevue: string | null;
  type: string;
  statut: string;
  pipeline_statut: string;
  publie_at: string | null;
  persona_nom: string | null;
  handle_tiktok: string | null;
  poster_prenom: string | null;
  poster_nom: string | null;
  sujet_titre: string | null;
}

/** Tous les posts, pour le calendrier admin. RLS admin = accès complet. */
export async function postsCalendrierAdmin(): Promise<PostCalendrierAdmin[]> {
  // L'embed profiles sous comptes fonctionne depuis la FK
  // comptes.poster_id → profiles.id (migration 0109).
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, compte_id, date_publication_prevue, type, statut, pipeline_statut, publie_at, " +
        "sujets(titre), comptes(persona_nom, handle_tiktok, profiles(prenom, nom))",
    )
    .order("date_publication_prevue", { ascending: false, nullsFirst: false })
    .limit(400);
  if (error) throw error;

  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((p) => ({
    id: p.id,
    compte_id: p.compte_id,
    date_publication_prevue: p.date_publication_prevue,
    type: p.type,
    statut: p.statut,
    pipeline_statut: p.pipeline_statut,
    publie_at: p.publie_at,
    persona_nom: p.comptes?.persona_nom ?? null,
    handle_tiktok: p.comptes?.handle_tiktok ?? null,
    poster_prenom: p.comptes?.profiles?.prenom ?? null,
    poster_nom: p.comptes?.profiles?.nom ?? null,
    sujet_titre: p.sujets?.titre ?? null,
  }));
}

/** Supprime un post et ses slides (cascade). Action admin, depuis le calendrier. */
export async function supprimerPost(id: string): Promise<void> {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
}

/** Modifie le texte d'une slide. Édition manuelle admin, aucun appel IA. */
export async function majTexteSlide(slideId: string, texte: string): Promise<void> {
  const { error } = await supabase
    .from("post_slides")
    .update({ texte_overlay: texte })
    .eq("id", slideId);
  if (error) throw error;
}

/** Relance le nettoyage d'une seule photo (déclenché à la main par l'admin).
 *  `remplacee` = le nettoyage a échoué mais la photo a été remplacée par une
 *  autre déjà propre de la bibliothèque du compte. */
export const renettoyerSlide = (postSlideId: string) =>
  invoke<{
    ok: boolean;
    nettoyee: boolean;
    remplacee?: boolean;
    verifie_sans_texte?: boolean;
    erreur?: string;
    motif?: string;
  }>("renettoyer", { postSlideId });

/** Fait pointer une slide vers un autre visuel déjà en bibliothèque. */
export async function majMediaSlide(slideId: string, mediaId: string): Promise<void> {
  const { error } = await supabase
    .from("post_slides")
    .update({ media_id: mediaId })
    .eq("id", slideId);
  if (error) throw error;
}

/** Retire la photo d'une slide (le visuel reste en bibliothèque, seul le lien
 *  saute). La slide affiche alors « photo manquante », à recharger. */
export async function retirerPhotoSlide(slideId: string): Promise<void> {
  const { error } = await supabase
    .from("post_slides")
    .update({ media_id: null })
    .eq("id", slideId);
  if (error) throw error;
}

/** Supprime une slide ENTIÈRE d'un post, puis renumérote les suivantes pour que
 *  les positions restent contiguës (1, 2, 3…). */
export async function supprimerSlide(slideId: string): Promise<void> {
  const { data: slide } = await supabase
    .from("post_slides")
    .select("post_id, position")
    .eq("id", slideId)
    .single();

  const { error } = await supabase.from("post_slides").delete().eq("id", slideId);
  if (error) throw error;

  if (slide) {
    const { data: apres } = await supabase
      .from("post_slides")
      .select("id, position")
      .eq("post_id", slide.post_id)
      .gt("position", slide.position)
      .order("position");
    for (const s of apres ?? []) {
      await supabase.from("post_slides").update({ position: s.position - 1 }).eq("id", s.id);
    }
  }
}

/** Nettoie une photo de la bibliothèque à la demande (bouton admin). */
export const nettoyerMedia = (mediaId: string) =>
  invoke<{ ok: boolean; nettoyee: boolean; erreur?: string }>("nettoyer-media", { mediaId });

/** Nettoyage de test NON destructif : renvoie l'image nettoyée sans rien écraser. */
export const nettoyerTest = (url: string) =>
  invoke<{ ok: boolean; url?: string; erreur?: string; motif?: string }>("nettoyer-test", { url });

/** Visuels bruts (à texte) regroupés par compte de référence, pour l'écran de test. */
export interface MediaTest {
  id: string;
  url: string;
  compte_reference_id: string | null;
  source: string;
}
export async function mediasBrutsParSource(): Promise<
  Array<{ source: string; medias: MediaTest[] }>
> {
  const { data, error } = await supabase
    .from("media_library")
    .select("id, url, compte_reference_id, storage_path, comptes_reference(handle_tiktok)")
    .like("storage_path", "brut/%")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;

  const groupes = new Map<string, { source: string; medias: MediaTest[] }>();
  // deno-lint-ignore no-explicit-any
  for (const m of data as any[]) {
    const source = m.comptes_reference?.handle_tiktok ?? "sans compte";
    if (!groupes.has(source)) groupes.set(source, { source, medias: [] });
    groupes.get(source)!.medias.push({
      id: m.id,
      url: m.url,
      compte_reference_id: m.compte_reference_id,
      source,
    });
  }
  return [...groupes.values()];
}

/** Supprime un visuel de la bibliothèque. Les slides qui l'utilisaient
 *  repassent à « photo manquante » (media_id mis à null par la FK). */
export async function supprimerMedia(mediaId: string): Promise<void> {
  const { error } = await supabase.from("media_library").delete().eq("id", mediaId);
  if (error) throw error;
}

/** Le compte de référence dont dépend un post — pour filtrer sa bibliothèque. */
export async function compteReferenceDuPost(postId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("comptes(compte_reference_id)")
    .eq("id", postId)
    .single();
  if (error) throw error;
  // deno-lint-ignore no-explicit-any
  return (data as any)?.comptes?.compte_reference_id ?? null;
}

export async function sujetsDisponibles(): Promise<Array<{ id: string; titre: string }>> {
  const { data, error } = await supabase
    .from("sujets")
    .select("id, titre")
    .eq("preparation_statut", "done")
    .in("statut", ["retenu", "utilise"])
    .order("pertinence_score", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as Array<{ id: string; titre: string }>;
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

/** Importe un slideshow depuis un lien TikTok collé à la main : scrape ce seul
 *  post et en fait un sujet, rattaché à un compte de référence (pour que ses
 *  visuels rejoignent la bonne bibliothèque). Le nettoyage et la composition
 *  suivent le cours normal ensuite. */
export const importerDepuisLien = (postUrl: string, compteReferenceId: string | null) =>
  invoke<{ ok: boolean; sujetId: string | null; reused: boolean; error?: string }>("extraction", {
    postUrl,
    compteReferenceId,
  });

/**
 * Assigne un TikTok précis à un créateur pour une date : on importe le lien (→
 * sujet, rattaché au compte de référence du créateur), puis on fabrique le post
 * pour ce créateur à cette date. Le nettoyage/traduction/Sophia suivent tout
 * seuls (le post attend la préparation avant de se composer).
 */
export async function assignerTikTok(input: {
  url: string;
  compteId: string;
  type?: string;
  date?: string;
  estTest?: boolean;
}): Promise<{ postId: string; reused: boolean }> {
  const { data: compte } = await supabase
    .from("comptes")
    .select("compte_reference_id")
    .eq("id", input.compteId)
    .single();

  const imp = await importerDepuisLien(input.url.trim(), compte?.compte_reference_id ?? null);
  if (!imp.sujetId) throw new Error(imp.error ?? "Aucun post photo trouvé à ce lien.");

  const post = await lancerComposition({
    compteId: input.compteId,
    sujetId: imp.sujetId,
    type: input.type,
    date: input.date,
    estTest: input.estTest,
  });
  return { postId: post.postId, reused: imp.reused };
}

export const lancerAssignation = (
  compteId?: string,
  type?: string,
  /** Mode test : crée un post même si le quota du jour est atteint. */
  forcer = false,
) =>
  invoke<{ resultats: Array<{ compteId: string; crees: number; types?: string[] }> }>(
    "assignation",
    { compteId: compteId ?? null, type: type ?? null, forcer },
  );

/** Simule le cron de minuit : assigne la journée à TOUS les comptes actifs pour
 *  la date choisie (comme minuit). */
export const lancerAssignationJour = (date: string) =>
  invoke<{ resultats: Array<{ compteId: string; crees: number; types?: string[] }> }>(
    "assignation",
    { date },
  );

/** Un pas de fabrication pour un post précis (avance le pipeline d'une étape). */
export const avancerUnPost = (postId: string) =>
  invoke<{ ok: boolean; etape?: string }>("composition", { postId });

/** Les posts d'une date donnée avec leur avancement, pour suivre en direct la
 *  simulation de minuit. */
export async function postsDuJour(date: string): Promise<
  Array<{ id: string; statut: string; nom: string }>
> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, pipeline_statut, comptes(persona_nom, handle_tiktok)")
    .eq("date_publication_prevue", date)
    .eq("est_test", false)
    .order("created_at");
  if (error) throw error;
  // deno-lint-ignore no-explicit-any
  return (data ?? []).map((p: any) => ({
    id: p.id,
    statut: p.pipeline_statut,
    nom: p.comptes?.persona_nom ?? p.comptes?.handle_tiktok ?? p.id.slice(0, 8),
  }));
}

export const genererPersona = (compteId: string, appliquer = false) =>
  invoke<{ pseudos: string[]; bio: string; avatarUrl: string | null; applique: boolean }>(
    "persona",
    { compteId, appliquer },
  );

export const lancerMetriques = (compteId?: string) =>
  invoke<{ resultats: Array<{ compteId: string; releves: number }> }>("metriques", {
    compteId: compteId ?? null,
  });

/** Répare les liens musique périmés (re-scrape des sons pour un lien stable). */
export const reparerMusique = () =>
  invoke<{ ok: boolean; examines: number; corriges: number; echecs: number }>(
    "backfill-musique",
    {},
  );

export const lancerComposition = (input: {
  compteId: string;
  sujetId: string;
  type?: string;
  date?: string;
  estTest?: boolean;
}) => invoke<{ postId: string }>("composition", input);

export interface PostScrapeTest {
  url: string;
  texte: string;
  photos: number;
  vues: number;
  likes: number;
  estPhoto: boolean;
  dejaVu: boolean;
  pertinence: number;
  raison: string;
  sophia: boolean;
}

/** Teste le scrape d'un compte de référence : renvoie ses posts avec leurs vues
 *  (triés par vues), SANS rien créer — pour vérifier que le moteur repère bien
 *  les TikToks qui performent. */
export const testerScrape = (compteReferenceId: string) =>
  invoke<{ ok: boolean; handle: string; posts: PostScrapeTest[]; error?: string }>("extraction", {
    testScrape: compteReferenceId,
  });
