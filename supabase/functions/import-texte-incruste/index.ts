/**
 * Import d'un slideshow à TEXTE INCRUSTÉ (white post, 0306).
 *
 * L'import ordinaire part d'un TikTok et en tire des images propres + un texte
 * à traduire. Ici le texte est dessiné dans l'image, une image par langue : il
 * n'y a rien à détecter, nettoyer ni traduire. Les images arrivent déjà rendues
 * (une série par langue), la fonction les range et crée le slideshow EN FILE de
 * validation (`brouillon` + `done`), comme n'importe quel import.
 *
 *   {
 *     source_url,              // le TikTok d'origine (clé anti-doublon)
 *     handle?,                 // compte d'origine — créé INACTIF s'il manque
 *     titre, langue_source,    // langue du TikTok d'origine
 *     vues_source?, pertinence?, pertinence_raison?,
 *     tier?,                   // sinon : la note d'import décide, comme à l'import
 *     labels: ["white-post"],  // slugs
 *     musique?: { url, titre, plateforme },
 *     langues: { fr: { images: [url…], hashtags? }, de: { … } }
 *   }
 *
 * Avec `contenu_id` (et `langues` seulement), la fonction AJOUTE des langues à
 * un white post existant (0307) au lieu d'en créer un : même nombre d'images
 * que sa structure, et une langue qui a déjà son deck est refusée. Le statut
 * du contenu ne bouge pas.
 *
 * Les images sont des JPEG ; leurs métadonnées sont retirées (EXIF, XMP, ICC,
 * C2PA…) avant d'entrer dans le storage. Une URL `api.apify.com` est lue avec le
 * jeton Apify (`downloadMedia`).
 *
 * Le compte d'origine est créé INACTIF : l'import ordinaire n'a rien à faire de
 * ses posts — il en OCRiserait le texte dessiné et en « nettoierait » l'image.
 */

import { downloadMedia } from "../_shared/apify.ts";
import { idsLabelsAssignables } from "../_shared/labels_systeme.ts";
import { noteImport } from "../_shared/note_import.ts";
import { estTier, passagesPourTier, tierImport, type Tier } from "../_shared/tierlist.ts";
import { cheminIncruste, jpegSansMetadonnees } from "../_shared/texte_incruste.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

const BUCKET = "medias";

interface CorpsImport {
  contenu_id?: string | null;
  source_url?: string;
  handle?: string | null;
  titre?: string;
  langue_source?: string;
  vues_source?: number | null;
  pertinence?: number | null;
  pertinence_raison?: string | null;
  tier?: string | null;
  labels?: string[];
  musique?: { url?: string | null; titre?: string | null; plateforme?: string | null } | null;
  langues?: Record<string, { images?: string[]; hashtags?: string | null }>;
}

function erreur(message: string, status = 400): Response {
  return json({ ok: false, error: message }, status);
}

type Supabase = ReturnType<typeof serviceClient>;
type LangueImport = { langue: string; images: string[]; hashtags: string };
type MediaRange = { id: string; langue: string; position: number; storage_path: string; url: string };

/** Télécharge, retire les métadonnées et range chaque image dans le storage.
 *  `ranges` est rempli au fil de l'eau : l'appelant le vide en cas d'échec. */
async function rangerImages(
  supabase: Supabase,
  contenuId: string,
  langues: LangueImport[],
  ranges: string[],
): Promise<MediaRange[]> {
  const medias: MediaRange[] = [];
  for (const l of langues) {
    for (const [i, url] of l.images.entries()) {
      const position = i + 1;
      const octets = jpegSansMetadonnees(await downloadMedia(url));
      const chemin = cheminIncruste(contenuId, l.langue, position);
      const { error: errUp } = await supabase.storage.from(BUCKET).upload(chemin, octets, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "3600",
      });
      if (errUp) throw new Error(`upload ${chemin} : ${errUp.message}`);
      ranges.push(chemin);
      medias.push({
        id: crypto.randomUUID(),
        langue: l.langue,
        position,
        storage_path: chemin,
        url: supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl,
      });
    }
  }
  return medias;
}

/** Ajout de langues à un white post existant (0307). */
async function ajouterLangues(supabase: Supabase, contenuId: string, langues: LangueImport[]): Promise<Response> {
  const { data: contenu, error: errC } = await supabase
    .from("contenus")
    .select("id, statut, texte_incruste, structure_slides")
    .eq("id", contenuId)
    .maybeSingle();
  if (errC) return erreur(messageErreur(errC), 500);
  if (!contenu) return erreur("contenu introuvable", 404);
  if (!contenu.texte_incruste) return erreur("ce contenu n'est pas à texte incrusté");
  const n = Array.isArray(contenu.structure_slides) ? contenu.structure_slides.length : 0;
  const inegale = langues.find((l) => l.images.length !== n);
  if (inegale) return erreur(`le contenu a ${n} slides, ${inegale.langue} en apporte ${inegale.images.length}`);

  const { data: decks, error: errD } = await supabase
    .from("contenu_langues")
    .select("langue")
    .eq("contenu_id", contenuId);
  if (errD) return erreur(messageErreur(errD), 500);
  const deja = langues.filter((l) => (decks ?? []).some((d) => d.langue === l.langue)).map((l) => l.langue);
  if (deja.length > 0) return json({ ok: false, error: "langue déjà présente", langues: deja }, 409);

  const ranges: string[] = [];
  try {
    const medias = await rangerImages(supabase, contenuId, langues, ranges);
    const { error: errRpc } = await supabase.rpc("ajouter_langues_texte_incruste", {
      p_contenu_id: contenuId,
      p_medias: medias,
      p_decks: langues.map((l) => ({ langue: l.langue, hashtags: l.hashtags })),
    });
    if (errRpc) throw errRpc;
  } catch (e) {
    if (ranges.length > 0) await supabase.storage.from(BUCKET).remove(ranges).catch(() => null);
    return erreur(messageErreur(e), 500);
  }
  return json({ ok: true, contenuId, statut: contenu.statut, slides: n, ajoutees: langues.map((l) => l.langue) });
}

Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;
  if (request.method !== "POST") return erreur("POST attendu", 405);

  let corps: CorpsImport;
  try {
    corps = (await request.json()) as CorpsImport;
  } catch {
    return erreur("corps JSON illisible");
  }

  const langues: LangueImport[] = Object.entries(corps.langues ?? {}).map(([langue, v]) => ({
    langue: langue.trim().toLowerCase(),
    images: (v?.images ?? []).map((u) => String(u).trim()).filter(Boolean),
    hashtags: (v?.hashtags ?? "").trim(),
  }));
  if (langues.length === 0) return erreur("au moins une langue requise");

  const contenuExistant = String(corps.contenu_id ?? "").trim();
  if (contenuExistant) return await ajouterLangues(serviceClient(), contenuExistant, langues);

  const sourceUrl = String(corps.source_url ?? "").trim();
  if (!sourceUrl) return erreur("source_url requis");
  const n = langues[0]!.images.length;
  if (n === 0) return erreur("aucune image");
  const inegale = langues.find((l) => l.images.length !== n);
  if (inegale) {
    return erreur(
      `chaque langue doit avoir le même nombre d'images : ${langues[0]!.langue}=${n}, ` +
        `${inegale.langue}=${inegale.images.length}`,
    );
  }

  const supabase = serviceClient();

  // Anti-doublon : un même TikTok n'entre qu'une fois en texte incrusté.
  const { data: existant, error: errEx } = await supabase
    .from("contenus")
    .select("id, statut")
    .eq("source_url", sourceUrl)
    .eq("texte_incruste", true)
    .maybeSingle();
  if (errEx) return erreur(messageErreur(errEx), 500);
  if (existant) {
    return json({ ok: false, error: "déjà importé", contenuId: existant.id, statut: existant.statut }, 409);
  }

  // Compte d'origine : retrouvé par handle, sinon créé inactif.
  let compteReferenceId: string | null = null;
  const handle = String(corps.handle ?? "").trim().replace(/^@/, "") || null;
  if (handle) {
    const { data: ref, error: errRef } = await supabase
      .from("comptes_reference")
      .select("id")
      .eq("handle_tiktok", handle)
      .maybeSingle();
    if (errRef) return erreur(messageErreur(errRef), 500);
    if (ref) {
      compteReferenceId = ref.id as string;
    } else {
      const { data: cree, error: errCree } = await supabase
        .from("comptes_reference")
        .insert({
          handle_tiktok: handle,
          niche: "white_post",
          langue: corps.langue_source ?? "en",
          is_active: false,
        })
        .select("id")
        .single();
      if (errCree || !cree) return erreur(messageErreur(errCree ?? "source non créée"), 500);
      compteReferenceId = cree.id as string;
    }
  }

  // Labels : par slug, jamais un label système ni un label retiré (0277).
  const slugs = (corps.labels ?? []).map((s) => String(s).trim()).filter(Boolean);
  let labelIds: string[] = [];
  if (slugs.length > 0) {
    const { data: labs, error: errLab } = await supabase
      .from("labels")
      .select("id, slug, retire_le")
      .in("slug", slugs);
    if (errLab) return erreur(messageErreur(errLab), 500);
    labelIds = idsLabelsAssignables(labs ?? []);
    if (labelIds.length !== slugs.length) {
      return erreur(`labels introuvables ou non assignables : ${slugs.join(", ")}`);
    }
  }

  // Note et tier d'entrée : même formule que l'import ordinaire.
  const { data: scoring } = await supabase
    .from("reglages")
    .select("valeur")
    .eq("cle", "scoring")
    .maybeSingle();
  const v = (scoring?.valeur ?? {}) as Record<string, number>;
  const vues = corps.vues_source ?? null;
  const pertinence = Math.min(100, Math.max(0, Number(corps.pertinence ?? 70)));
  const note = noteImport({
    pertinence,
    vues,
    prior: v.score_prior ?? 50,
    k: v.elo_regularisation_k ?? 1,
    poidsVues: v.elo_poids_vues ?? 0.7,
    vuesPlafond: v.elo_vues_plafond ?? 80_000,
  });
  const tier: Tier | null = estTier(corps.tier) ? corps.tier : tierImport(note, vues);

  const contenuId = crypto.randomUUID();
  const ranges: string[] = [];

  try {
    const medias = await rangerImages(supabase, contenuId, langues, ranges);

    const { error: errRpc } = await supabase.rpc("creer_contenu_texte_incruste", {
      p_contenu: {
        id: contenuId,
        nb_slides: n,
        titre: String(corps.titre ?? "").trim(),
        source_url: sourceUrl,
        compte_reference_id: compteReferenceId,
        langue_source: corps.langue_source ?? "en",
        vues_source: vues,
        pertinence_score: Math.round(pertinence),
        pertinence_raison: corps.pertinence_raison ?? null,
        tier,
        passages_cible: tier ? passagesPourTier(tier) : 0,
        tier_note_import: note,
        musique_url: corps.musique?.url ?? null,
        musique_titre: corps.musique?.titre ?? null,
        musique_plateforme: corps.musique?.plateforme ?? null,
      },
      p_medias: medias,
      p_decks: langues.map((l) => ({ langue: l.langue, hashtags: l.hashtags })),
      p_label_ids: labelIds,
    });
    if (errRpc) throw errRpc;
  } catch (e) {
    // Rien n'a été écrit en base (une transaction) : on ne laisse pas non plus
    // de fichiers orphelins dans le storage.
    if (ranges.length > 0) await supabase.storage.from(BUCKET).remove(ranges).catch(() => null);
    return erreur(messageErreur(e), 500);
  }

  return json({
    ok: true,
    contenuId,
    tier,
    note: Math.round(note * 10) / 10,
    slides: n,
    langues: langues.map((l) => l.langue),
    compteReferenceId,
  });
});
