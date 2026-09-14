/**
 * Accès Supabase pour la file de validation, les formats et les blocs PNG.
 *
 * Séparé d'`api.ts` (déjà 6 600 lignes) : tout ce qui touche à la file vit ici.
 */

import { supabase } from "@/lib/supabase/client";
import { slugFormat } from "@/features/moteur/fileValidation";
import type { ContenuStat, PassageStat } from "@/features/moteur/statsFormats";
import { estTier, tierImport } from "@/features/moteur/tierlist";
import type { BlocPng, Format } from "@/features/moteur/types";

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

export async function listerFormats(opts?: { actifsSeuls?: boolean }): Promise<Format[]> {
  let q = supabase.from("formats").select("*").order("nom");
  if (opts?.actifsSeuls) q = q.eq("actif", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Format[];
}

export async function creerFormat(input: {
  nom: string;
  couleur?: string | null;
  description?: string | null;
}): Promise<Format> {
  const nom = input.nom.trim();
  if (!nom) throw new Error("Nom requis");
  const base = slugFormat(nom);
  // Collision de slug : un suffixe, pas une erreur jetée à la figure de l'admin.
  for (let i = 0; i < 5; i += 1) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await supabase
      .from("formats")
      .insert({
        nom,
        slug,
        couleur: input.couleur ?? null,
        description: input.description?.trim() || null,
      })
      .select("*")
      .single();
    if (!error && data) return data as Format;
    if (error && error.code !== "23505") throw error;
  }
  throw new Error("Slug de format déjà pris");
}

export async function majFormat(
  id: string,
  patch: Partial<Pick<Format, "nom" | "couleur" | "description" | "actif">>,
): Promise<void> {
  const { error } = await supabase.from("formats").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Supprime un format. Les slideshows qui le portaient repassent à « aucun »
 * (`on delete set null`) — leurs statistiques passées ne sont pas réécrites,
 * elles deviennent simplement « sans format ».
 */
export async function supprimerFormat(id: string): Promise<void> {
  const { error } = await supabase.from("formats").delete().eq("id", id);
  if (error) throw error;
}

/** Pose (ou retire) le format d'un slideshow — y compris après validation. */
export async function definirFormatContenu(
  contenuId: string,
  formatId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("contenus")
    .update({ format_id: formatId })
    .eq("id", contenuId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Bibliothèque de blocs PNG
// ---------------------------------------------------------------------------

export async function listerBlocsPng(): Promise<BlocPng[]> {
  const { data, error } = await supabase
    .from("blocs_png")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BlocPng[];
}

export async function televerserBlocPng(input: {
  nom: string;
  fichier: File;
  largeur?: number | null;
  hauteur?: number | null;
}): Promise<BlocPng> {
  const nom = input.nom.trim() || input.fichier.name.replace(/\.[^.]+$/, "");
  const ext = (input.fichier.name.split(".").pop() ?? "png").toLowerCase();
  const id = crypto.randomUUID();
  const path = `blocs/${id}.${ext}`;

  const { error: errUp } = await supabase.storage.from("medias").upload(path, input.fichier, {
    contentType: input.fichier.type || "image/png",
    upsert: false,
    cacheControl: "3600",
  });
  if (errUp) throw new Error(errUp.message);

  const url = supabase.storage.from("medias").getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabase
    .from("blocs_png")
    .insert({
      id,
      nom,
      storage_path: path,
      url,
      largeur: input.largeur ?? null,
      hauteur: input.hauteur ?? null,
    })
    .select("*")
    .single();
  if (error) {
    // La ligne n'est pas passée : ne pas laisser un fichier orphelin derrière.
    await supabase.storage.from("medias").remove([path]);
    throw error;
  }
  return data as BlocPng;
}

export async function supprimerBlocPng(bloc: Pick<BlocPng, "id" | "storage_path">): Promise<void> {
  const { error } = await supabase.from("blocs_png").delete().eq("id", bloc.id);
  if (error) throw error;
  await supabase.storage.from("medias").remove([bloc.storage_path]);
}

// ---------------------------------------------------------------------------
// File : validation, réédition, purge
// ---------------------------------------------------------------------------

/**
 * Fait sortir un slideshow de la file : il entre dans le pool d'assignation.
 *
 * Le tier et `passages_cible` ont été posés à l'import (étape 4) ; l'admin a
 * pu les corriger dans la file. On ne les touche pas ici.
 */
export async function validerSlideshow(contenuId: string): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("contenus")
    .update({
      statut: "valide",
      valide_at: new Date().toISOString(),
      valide_par: session.user?.id ?? null,
    })
    .eq("id", contenuId);
  if (error) throw error;
}

/**
 * Renvoie un slideshow validé dans la file (Q17 : la validation est
 * rééditable).
 *
 * Les passages et les posts déjà créés ne bougent pas : ils portent leur
 * propre copie des slides. Un créateur qui a un post pour aujourd'hui le garde.
 * Seules les PROCHAINES assignations cessent de piocher ce slideshow.
 */
export async function remettreEnFile(contenuId: string): Promise<void> {
  const { error } = await supabase
    .from("contenus")
    .update({ statut: "brouillon", valide_at: null, valide_par: null })
    .eq("id", contenuId);
  if (error) throw error;
}

export async function ecrireNoteFile(contenuId: string, note: string): Promise<void> {
  const { error } = await supabase
    .from("contenus")
    .update({ file_note: note.trim() || null })
    .eq("id", contenuId);
  if (error) throw error;
}

/** Combien de slideshows attendent un admin. */
export async function compterFile(applicationId?: string | null): Promise<number> {
  let q = supabase
    .from("contenus")
    .select("id", { count: "exact", head: true })
    .eq("statut", "brouillon")
    .eq("import_statut", "done");
  if (applicationId) q = q.eq("application_id", applicationId);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/** Ids en file, pour une purge — la suppression elle-même passe par api.ts. */
export async function idsEnFile(applicationId?: string | null): Promise<string[]> {
  let q = supabase
    .from("contenus")
    .select("id")
    .eq("statut", "brouillon")
    .eq("import_statut", "done")
    .order("created_at", { ascending: true });
  if (applicationId) q = q.eq("application_id", applicationId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((c) => c.id as string);
}

// ---------------------------------------------------------------------------
// Édition d'une slide dans la file
// ---------------------------------------------------------------------------

/**
 * Réécrit l'image propre d'une slide, APRÈS montage des calques PNG côté
 * navigateur.
 *
 * Le fichier est réécrit **sur son propre `storage_path`** : `trouverPropreExistant`
 * cherche le préfixe `propre/<contenu>/<position>.`, donc un chemin suffixé
 * casserait la reprise d'import (même règle que `format_media.ts`). D'où le
 * cache-buster sur l'URL renvoyée : le chemin ne change pas, le contenu si.
 *
 * Le `brut/` n'est jamais touché — un ré-import reconstruit toujours tout.
 */
export async function remplacerImagePropre(
  media: { id: string; storage_path: string },
  blob: Blob,
  /** Slide retouchée, pour invalider le rendu brûlé correspondant. */
  slide?: { contenuId: string; position: number },
): Promise<string> {
  const { error: errUp } = await supabase.storage
    .from("medias")
    .upload(media.storage_path, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });
  if (errUp) throw new Error(errUp.message);

  const pub = supabase.storage.from("medias").getPublicUrl(media.storage_path).data.publicUrl;
  const url = `${pub}?v=${Date.now()}`;

  // `texte_restant` retombe à false : l'admin vient de décider de cette image.
  const { error } = await supabase
    .from("media_library")
    .update({ url, texte_restant: false })
    .eq("id", media.id);
  if (error) throw error;

  // `burn_rendus` garde l'image finale brûlée par (contenu, position, langue),
  // calculée sur l'image PROPRE : elle est fausse maintenant, on la jette (même
  // geste qu'`invaliderBurn` côté Edge). `burn_analyses`, lui, est lu sur le
  // BRUT — que cette fonction ne touche jamais — et reste valable.
  if (slide) {
    await supabase
      .from("burn_rendus")
      .delete()
      .eq("contenu_id", slide.contenuId)
      .eq("position", slide.position);
  }
  return url;
}

/** Remplace la structure de slides d'un contenu (ordre, suppression). */
export async function ecrireStructureSlides(
  contenuId: string,
  slides: Array<Record<string, unknown>>,
): Promise<void> {
  const { error } = await supabase
    .from("contenus")
    .update({ structure_slides: slides })
    .eq("id", contenuId);
  if (error) throw error;
}

/** Musique, titre, hashtags : les champs plats d'un slideshow. */
export async function majChampsContenu(
  contenuId: string,
  patch: {
    titre?: string;
    musique_url?: string | null;
    musique_titre?: string | null;
    musique_plateforme?: string | null;
    tier?: string | null;
    passages_cible?: number;
  },
): Promise<void> {
  const { error } = await supabase.from("contenus").update(patch).eq("id", contenuId);
  if (error) throw error;
}

export async function majHashtagsDeck(
  contenuLangueId: string,
  hashtags: string,
): Promise<void> {
  const { error } = await supabase
    .from("contenu_langues")
    .update({ hashtags: hashtags.trim() || null })
    .eq("id", contenuLangueId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Statistiques par format
// ---------------------------------------------------------------------------

/**
 * Charge de quoi croiser format × label : les slideshows et leurs passages.
 *
 * Un seul aller-retour par table plutôt qu'une agrégation SQL : le stock est
 * de l'ordre de quelques centaines de lignes, et garder le calcul dans un
 * module pur (`statsFormats.ts`) le rend testable.
 */
export async function chargerStatsFormats(applicationId?: string | null): Promise<{
  contenus: ContenuStat[];
  passages: PassageStat[];
}> {
  let qc = supabase
    .from("contenus")
    .select("id, format_id, tier, tier_note_import, vues_source, statut")
    .neq("statut", "rejete");
  if (applicationId) qc = qc.eq("application_id", applicationId);

  const [{ data: contenus, error: errC }, { data: liens, error: errL }] = await Promise.all([
    qc,
    supabase.from("contenu_labels").select("contenu_id, label_id"),
  ]);
  if (errC) throw errC;
  if (errL) throw errL;

  const labelsPar = new Map<string, string[]>();
  for (const l of liens ?? []) {
    const cid = l.contenu_id as string;
    labelsPar.set(cid, [...(labelsPar.get(cid) ?? []), l.label_id as string]);
  }

  const ids = (contenus ?? []).map((c) => c.id as string);
  const passages: PassageStat[] = [];
  // `.in()` sur des centaines d'ids fait une URL trop longue pour PostgREST.
  for (let i = 0; i < ids.length; i += 200) {
    const lot = ids.slice(i, i + 200);
    if (lot.length === 0) break;
    const { data, error } = await supabase
      .from("passages")
      .select("contenu_id, vues, langue, date_publication_prevue, bonus_repost, posts(est_test)")
      .in("contenu_id", lot)
      .eq("statut", "publie");
    if (error) throw error;
    for (const p of data ?? []) {
      const posts = p.posts as { est_test?: boolean | null } | Array<{ est_test?: boolean | null }> | null;
      const post = Array.isArray(posts) ? posts[0] : posts;
      passages.push({
        contenuId: p.contenu_id as string,
        vues: (p.vues as number | null) ?? null,
        langue: (p.langue as string | null) ?? null,
        jour: (p.date_publication_prevue as string | null) ?? null,
        horsCycle: Boolean(p.bonus_repost) || Boolean(post?.est_test),
      });
    }
  }

  return {
    contenus: (contenus ?? []).map((c) => ({
      id: c.id as string,
      formatId: (c.format_id as string | null) ?? null,
      labelIds: labelsPar.get(c.id as string) ?? [],
      tier: estTier(c.tier) ? c.tier : null,
      // Le tier d'entrée n'est pas stocké : on le rejoue avec la règle exacte
      // de l'import (note + plafond vues source) pour mesurer le chemin
      // parcouru depuis. Sans note gardée, pas de comparaison possible.
      tierImport:
        c.tier_note_import == null
          ? null
          : tierImport(Number(c.tier_note_import), (c.vues_source as number | null) ?? null),
    })),
    passages,
  };
}

// ---------------------------------------------------------------------------
// Placement micabo écrit à la main
// ---------------------------------------------------------------------------

/**
 * Dit où l'admin a posé le CTA micabo dans le deck source, et bascule le
 * slideshow en placement manuel (0258).
 *
 * `position = null` rend la main au moteur : le drapeau retombe, toutes les
 * marques `position_sophia` du deck source sont effacées, et
 * `assurerDeckPourLangue` replacera le CTA comme avant.
 *
 * Les decks des AUTRES langues sont vidés dans les deux sens : ils portent un
 * placement qui vient de l'ancienne règle, ils doivent être refaits. Vider un
 * deck de langue ne coûte qu'une traduction — celle-ci se refait à la demande,
 * au prochain passage d'un créateur de cette langue.
 */
export async function definirPlacementManuel(
  contenuId: string,
  langueSource: string,
  position: number | null,
): Promise<void> {
  const { data: decks, error: errD } = await supabase
    .from("contenu_langues")
    .select("id, langue, slides")
    .eq("contenu_id", contenuId);
  if (errD) throw errD;

  for (const deck of decks ?? []) {
    const slides = ((deck.slides ?? []) as Array<{
      position: number;
      texte_overlay: string | null;
      position_sophia: boolean;
    }>);
    if (deck.langue === langueSource) {
      const { error } = await supabase
        .from("contenu_langues")
        .update({
          slides: slides.map((s) => ({ ...s, position_sophia: s.position === position })),
        })
        .eq("id", deck.id);
      if (error) throw error;
    } else if (slides.length > 0) {
      const { error } = await supabase
        .from("contenu_langues")
        .update({ slides: [] })
        .eq("id", deck.id);
      if (error) throw error;
    }
  }

  const { error } = await supabase
    .from("contenus")
    .update({ placement_manuel: position != null })
    .eq("id", contenuId);
  if (error) throw error;

  // Les rendus brûlés portent l'ancien texte : ils sont faux dans toutes les
  // langues dès que le deck bouge.
  await supabase.from("burn_rendus").delete().eq("contenu_id", contenuId);
}
