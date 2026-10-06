/**
 * Atelier AI UGC (0308, 06/10/2026) — personas, modèles, rendus, démos.
 *
 *   { action: "persona_brouillon", cle, urls }
 *       → rapatrie des images (Higgsfield…) sous ugc/personas/brouillon/<cle>/,
 *         C2PA retiré, pour les regarder avant de choisir.
 *   { action: "persona_creer", nom, images: { face, left, right, down, profil }, prompt? }
 *       → ugc_personas. Une image = un chemin du bucket ou une URL.
 *   { action: "modele_importer", url }
 *       → ugc_modeles. En tâche de fond : Apify (vidéo), planche d'images,
 *         coupe proposée par un modèle de vision.
 *   { action: "modele_couper", id, debut_s, fin_s, demo_debut_s? }
 *       → en tâche de fond : segment réaction (Fal, sans recodage), image de
 *         départ, la même sans texte, OCR des deux segments. Statut `pret`.
 *   { action: "modele_textes", id, textes }
 *   { action: "rendu_lancer", modele_id, persona_id, moteur?, decor? }
 *       → ugc_rendus. En tâche de fond : Nano Banana (le persona dans l'image
 *         de départ), puis soumission Kling motion control. Kling met plusieurs
 *         minutes : la fonction ne l'attend pas.
 *   { action: "rendus_suivre" }
 *       → relève les Kling soumis et finalise ceux qui sont prêts : contrôle de
 *         durée, MP4 sans métadonnées, ligne media_library, statut `a_valider`.
 *   { action: "rendu_decider", id, decision: "valide" | "rejete", motif? }
 *   { action: "demo_ajouter", chemin, langue, titre? }
 *       → MP4 déjà déposé par l'admin sous ugc/demos/ : métadonnées retirées
 *         en place, media_library, ugc_demos.
 *
 * Rien ici n'est lu par l'assignation : c'est l'atelier du premier lot.
 */

import { downloadMedia, scrapeVideoPost } from "../_shared/apify.ts";
import { retirerContentCredentialsBytes } from "../_shared/c2pa.ts";
import { falLlmTexte } from "../_shared/fal_llm.ts";
import { editerNanoBananaPro } from "../_shared/fal_nano_banana.ts";
import { sonderVideoMeta } from "../_shared/fal_normaliser_video.ts";
import {
  falAuthHeaders,
  falDownloadBytes,
  falHebergerOctets,
  falKey,
  falQueueAwaitJson,
  falQueueSubmit,
} from "../_shared/fal_queue.ts";
import { trimmerVideoFal } from "../_shared/fal_trim_video.ts";
import { cleanImage, ocrFrame } from "../_shared/gemini.ts";
import { metadonneesMp4, mp4SansMetadonnees } from "../_shared/mp4_metadonnees.ts";
import {
  coutRendu,
  dureeReactionValide,
  estMoteurKling,
  idVideoTiktok,
  instantsPlanche,
  lireCoupe,
  MOTEUR_DEFAUT,
  MOTEURS_KLING,
  type MoteurKling,
  normaliserTextes,
  pasPlanche,
  PROMPT_KLING,
  promptCoupe,
  promptPersona,
  REACTION_MAX_S,
  REACTION_MIN_S,
  renduAssezLong,
  type SegmentTexte,
} from "../_shared/ugc_video.ts";
import {
  assertAuthorised,
  corsHeaders,
  json,
  messageErreur,
  serviceClient,
} from "../_shared/supabase.ts";

const BUCKET = "medias";
const MODELE_COUPE = "google/gemini-2.5-flash";
/** Au-delà, un rendu encore « en cours » est réputé perdu. */
const KLING_ABANDON_MS = 60 * 60 * 1000;
const IMAGE_ABANDON_MS = 15 * 60 * 1000;

type Supabase = ReturnType<typeof serviceClient>;

function urlPublique(supabase: Supabase, chemin: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
}

async function deposer(supabase: Supabase, chemin: string, octets: Uint8Array, mime: string): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, octets, {
    contentType: mime,
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error(`Storage ${chemin} : ${error.message}`);
  return urlPublique(supabase, chemin);
}

async function lireStorage(supabase: Supabase, chemin: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(BUCKET).download(chemin);
  if (error || !data) throw new Error(`Storage ${chemin} illisible : ${error?.message ?? "vide"}`);
  return new Uint8Array(await data.arrayBuffer());
}

async function telecharger(url: string): Promise<{ octets: Uint8Array; mime: string }> {
  const r = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36" },
  });
  if (!r.ok) throw new Error(`Téléchargement ${r.status} (${url.slice(0, 80)})`);
  const octets = new Uint8Array(await r.arrayBuffer());
  if (octets.length < 100) throw new Error(`Fichier vide (${url.slice(0, 80)})`);
  return { octets, mime: (r.headers.get("content-type") ?? "").split(";")[0]!.trim() };
}

/** Image d'un chemin du bucket ou d'une URL, Content Credentials retirés. */
async function imagePropre(supabase: Supabase, source: string): Promise<{ octets: Uint8Array; mime: string; ext: string }> {
  const brut = /^https?:\/\//.test(source)
    ? (await telecharger(source)).octets
    : await lireStorage(supabase, source);
  const r = await retirerContentCredentialsBytes(brut);
  const mime = r.mime === "application/octet-stream" ? "image/png" : r.mime;
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
  return { octets: r.bytes, mime, ext };
}

/** La suite tourne après la réponse : l'appelant relit la table. */
function enArrierePlan(travail: Promise<unknown>): void {
  const edge = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
  const p = travail.catch((e) => console.error("ugc-video (fond)", messageErreur(e)));
  if (edge) edge.waitUntil(p);
}

/** `sub` du JWT admin (déjà vérifié par assertAuthorised), sinon null. */
function auteurDe(request: Request): string | null {
  const jeton = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  try {
    const charge = JSON.parse(atob(jeton.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof charge.sub === "string" ? charge.sub : null;
  } catch {
    return null;
  }
}

async function majModele(supabase: Supabase, id: string, champs: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("ugc_modeles")
    .update({ ...champs, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`ugc_modeles : ${error.message}`);
}

async function majRendu(supabase: Supabase, id: string, champs: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from("ugc_rendus")
    .update({ ...champs, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`ugc_rendus : ${error.message}`);
}

/* ─── Personas ─────────────────────────────────────────────────────────── */

async function personaBrouillon(supabase: Supabase, cle: string, urls: string[]) {
  if (!/^[a-z0-9-]{1,40}$/.test(cle)) throw new Error("cle : minuscules, chiffres et tirets");
  const chemins: string[] = [];
  for (const [i, url] of urls.slice(0, 12).entries()) {
    const img = await imagePropre(supabase, url);
    const chemin = `ugc/personas/brouillon/${cle}/${i + 1}.${img.ext}`;
    await deposer(supabase, chemin, img.octets, img.mime);
    chemins.push(chemin);
  }
  return { chemins };
}

const CLES_PERSONA = ["face", "left", "right", "down", "profil"] as const;

async function personaCreer(supabase: Supabase, body: Record<string, unknown>) {
  const nom = String(body.nom ?? "").trim();
  if (!nom) throw new Error("nom requis");
  const images = (body.images ?? {}) as Record<string, unknown>;
  for (const c of CLES_PERSONA) {
    if (!String(images[c] ?? "").trim()) throw new Error(`image ${c} requise`);
  }
  const id = crypto.randomUUID();
  const urls: Record<string, string> = {};
  for (const c of CLES_PERSONA) {
    const img = await imagePropre(supabase, String(images[c]).trim());
    urls[c] = await deposer(supabase, `ugc/personas/${id}/${c}.${img.ext}`, img.octets, img.mime);
  }
  const { data, error } = await supabase
    .from("ugc_personas")
    .insert({
      id,
      nom,
      prompt_base: String(body.prompt ?? "").trim(),
      image_face_url: urls.face,
      image_left_url: urls.left,
      image_right_url: urls.right,
      image_down_url: urls.down,
      image_profile_url: urls.profil,
      storage_prefix: `ugc/personas/${id}`,
    })
    .select("*")
    .single();
  if (error) throw new Error(`ugc_personas : ${error.message}`);
  return { persona: data };
}

/* ─── Modèles ──────────────────────────────────────────────────────────── */

function normaliserLien(brut: string): string {
  const u = brut.trim();
  if (!/^https?:\/\/([a-z]+\.)?tiktok\.com\//i.test(u)) throw new Error("Lien TikTok attendu");
  return u.split("?")[0]!;
}

/** Images de la vidéo, une toutes les ~0,5 s, datées. URL Fal. */
async function planche(videoUrlFal: string, dureeSec: number, fps: number) {
  const modele = "fal-ai/workflow-utilities/extract-nth-frame";
  const q = await falQueueSubmit(modele, { video_url: videoUrlFal, frame_index: pasPlanche(dureeSec, fps) });
  const r = (await falQueueAwaitJson(modele, q, undefined, 120_000)) as { images?: Array<{ url?: string }> };
  const urls = (r.images ?? []).map((i) => i.url).filter((u): u is string => Boolean(u));
  const instants = instantsPlanche(urls.length, dureeSec);
  return urls.map((url, k) => ({ t: instants[k]!, url }));
}

async function proposerCoupe(images: Array<{ t: number; url: string }>, dureeSec: number) {
  // Au plus 40 images vers le modèle : on en saute une sur deux au besoin.
  const pas = Math.max(1, Math.ceil(images.length / 40));
  const choix = images.filter((_, k) => k % pas === 0);
  const texte = await falLlmTexte({
    model: MODELE_COUPE,
    temperature: 0,
    prompt: promptCoupe(choix.map((i) => i.t), dureeSec),
    imageUrls: choix.map((i) => i.url),
  });
  return lireCoupe(texte, dureeSec);
}

async function importerModele(supabase: Supabase, id: string, url: string): Promise<void> {
  try {
    const video = await scrapeVideoPost(url);
    const { data: doublon } = await supabase
      .from("ugc_modeles")
      .select("id")
      .eq("tiktok_post_id", video.postId)
      .neq("id", id)
      .maybeSingle();
    if (doublon) throw new Error(`Déjà importé : modèle ${String(doublon.id).slice(0, 8)}`);

    const octets = await downloadMedia(video.videoUrl);
    const sourcePath = `ugc/modeles/${id}/source.mp4`;
    await deposer(supabase, sourcePath, octets, "video/mp4");
    const falUrl = await falHebergerOctets(octets, "video/mp4", `modele-${id.slice(0, 8)}.mp4`);
    const meta = await sonderVideoMeta(falUrl);
    const duree = meta.durationSec ?? (video.dureeMs ? video.dureeMs / 1000 : 0);
    if (!(duree > 0)) throw new Error("Durée de la vidéo illisible");

    const images = await planche(falUrl, duree, meta.fps ?? 30);
    let coupe = null;
    try {
      coupe = images.length >= 4 ? await proposerCoupe(images, duree) : null;
    } catch (e) {
      console.error("coupe", messageErreur(e));
    }

    await majModele(supabase, id, {
      titre: video.text.trim().slice(0, 80) || `Modèle ${video.postId.slice(-6)}`,
      source_url: video.webVideoUrl || url,
      tiktok_post_id: video.postId,
      legende_source: video.text || null,
      vues_source: video.stats.vues,
      musique_url: video.musicUrl,
      musique_titre: video.musicTitle,
      source_path: sourcePath,
      source_duree_ms: Math.round(duree * 1000),
      largeur: meta.width ?? video.largeur,
      hauteur: meta.height ?? video.hauteur,
      planche: images,
      coupe_proposee: coupe,
      reaction_debut_s: coupe?.debut_s ?? null,
      reaction_fin_s: coupe?.fin_s ?? null,
      erreur: null,
    });
  } catch (e) {
    await majModele(supabase, id, { erreur: messageErreur(e) }).catch(() => null);
  }
}

/** Première image d'une vidéo hébergée chez Fal. */
async function premiereImage(videoUrlFal: string): Promise<string> {
  const modele = "fal-ai/ffmpeg-api/extract-frame";
  const q = await falQueueSubmit(modele, { video_url: videoUrlFal, frame_type: "first" });
  const r = (await falQueueAwaitJson(modele, q, undefined, 120_000)) as { images?: Array<{ url?: string }> };
  const url = r.images?.[0]?.url;
  if (!url) throw new Error("extract-frame : pas d'image");
  return url;
}

async function couperModele(
  supabase: Supabase,
  id: string,
  debut: number,
  fin: number,
  demoDebut: number | null,
): Promise<void> {
  try {
    const { data: m, error } = await supabase.from("ugc_modeles").select("*").eq("id", id).single();
    if (error || !m) throw new Error("modèle introuvable");
    if (!m.source_path) throw new Error("vidéo source absente (import pas fini ?)");

    const source = await lireStorage(supabase, m.source_path as string);
    const falSource = await falHebergerOctets(source, "video/mp4", `source-${id.slice(0, 8)}.mp4`);
    const coupe = await trimmerVideoFal({ videoUrl: falSource, startSec: debut, endSec: fin });
    const reactionPath = `ugc/modeles/${id}/reaction.mp4`;
    await deposer(supabase, reactionPath, coupe.bytes, "video/mp4");

    const image = await telecharger(await premiereImage(coupe.url));
    const imageRefPath = `ugc/modeles/${id}/image_ref.jpg`;
    const imageRefUrl = await deposer(supabase, imageRefPath, image.octets, image.mime || "image/jpeg");

    // La même image sans texte : Figure 1 de Nano Banana. Sans nettoyage
    // réussi, le prompt interdit déjà le texte, on garde l'image brute.
    let imagePropreChemin: string | null = null;
    try {
      const propre = await cleanImage(imageRefUrl);
      if (propre) {
        const octets = Uint8Array.from(atob(propre.base64), (c) => c.charCodeAt(0));
        const ext = propre.mime.includes("jpeg") ? "jpg" : propre.mime.includes("webp") ? "webp" : "png";
        imagePropreChemin = `ugc/modeles/${id}/image_propre.${ext}`;
        await deposer(supabase, imagePropreChemin, octets, propre.mime);
      }
    } catch (e) {
      console.error("nettoyage image_ref", messageErreur(e));
    }

    // Textes : on ne remplace pas ce que l'admin a déjà corrigé.
    let textes = normaliserTextes(m.textes);
    if (textes.length === 0) {
      const reaction = await ocrFrame(imageRefUrl).catch(() => "");
      let demo = "";
      const plancheImages = (Array.isArray(m.planche) ? m.planche : []) as Array<{ t: number; url: string }>;
      const reperes = demoDebut ?? fin;
      const imageDemo = plancheImages.find((i) => i.t >= reperes + 0.8) ?? null;
      if (imageDemo) demo = await ocrFrame(imageDemo.url).catch(() => "");
      textes = normaliserTextes([
        { segment: "reaction", texte: reaction },
        { segment: "demo", texte: demo },
      ]);
    }

    await majModele(supabase, id, {
      reaction_debut_s: debut,
      reaction_fin_s: fin,
      reaction_path: reactionPath,
      image_ref_path: imageRefPath,
      image_propre_path: imagePropreChemin,
      textes,
      statut: "pret",
      erreur: null,
    });
  } catch (e) {
    await majModele(supabase, id, { erreur: messageErreur(e) }).catch(() => null);
  }
}

/* ─── Rendus ───────────────────────────────────────────────────────────── */

async function lancerRendu(supabase: Supabase, renduId: string): Promise<void> {
  try {
    const { data: r, error } = await supabase
      .from("ugc_rendus")
      .select("*, modele:ugc_modeles(*), persona:ugc_personas(*)")
      .eq("id", renduId)
      .single();
    if (error || !r) throw new Error("rendu introuvable");
    const modele = r.modele as Record<string, unknown>;
    const persona = r.persona as Record<string, unknown>;
    const figure1 = String(modele.image_propre_path ?? modele.image_ref_path ?? "");
    if (!figure1 || !modele.reaction_path) throw new Error("modèle pas coupé");

    const refs = ["image_face_url", "image_left_url", "image_right_url", "image_down_url", "image_profile_url"]
      .map((c) => String(persona[c] ?? "").trim())
      .filter(Boolean);
    if (refs.length === 0) throw new Error("persona sans images");

    // 1. Le persona dans l'image de départ.
    const nb = await editerNanoBananaPro(
      [urlPublique(supabase, figure1), ...refs],
      promptPersona(r.decor === "source" ? "source" : "persona"),
      undefined,
      { aspectRatio: "auto" },
    );
    const nette = await retirerContentCredentialsBytes(nb.bytes);
    const imagePath = `ugc/rendus/${renduId}/persona.png`;
    await deposer(supabase, imagePath, nette.bytes, "image/png");
    await majRendu(supabase, renduId, { image_persona_path: imagePath, etape: "kling" });

    // 2. Kling : l'image du persona + la réaction comme vidéo de mouvement.
    // Les deux sont hébergées chez Fal : les runners ne relisent pas Supabase.
    const reaction = await lireStorage(supabase, String(modele.reaction_path));
    const videoUrl = await falHebergerOctets(reaction, "video/mp4", `reaction-${renduId.slice(0, 8)}.mp4`);
    const imageUrl = await falHebergerOctets(nette.bytes, "image/png", `persona-${renduId.slice(0, 8)}.png`);
    const moteur = (estMoteurKling(r.moteur) ? r.moteur : MOTEUR_DEFAUT) as MoteurKling;
    const endpoint = MOTEURS_KLING[moteur].endpoint;
    const q = await falQueueSubmit(endpoint, {
      image_url: imageUrl,
      video_url: videoUrl,
      character_orientation: "video",
      // Livrée muette : le créateur pose un son natif dans TikTok.
      keep_original_sound: false,
      prompt: PROMPT_KLING,
    });
    await majRendu(supabase, renduId, {
      fal_endpoint: endpoint,
      fal_request_id: q.request_id ?? null,
      fal_status_url: q.status_url ?? null,
      fal_response_url: q.response_url ?? null,
      kling_soumis_at: new Date().toISOString(),
    });
  } catch (e) {
    await majRendu(supabase, renduId, { statut: "echec", erreur: messageErreur(e) }).catch(() => null);
  }
}

async function finaliserRendu(supabase: Supabase, r: Record<string, unknown>, sortie: Record<string, unknown>) {
  const id = String(r.id);
  const video = (sortie.video ?? (sortie.data as Record<string, unknown> | undefined)?.video) as
    | { url?: string }
    | undefined;
  if (!video?.url) throw new Error(`Kling sans vidéo : ${JSON.stringify(sortie).slice(0, 200)}`);

  const { data: m } = await supabase
    .from("ugc_modeles")
    .select("reaction_debut_s, reaction_fin_s")
    .eq("id", r.modele_id as string)
    .single();
  const dureeReaction = Number(m?.reaction_fin_s ?? 0) - Number(m?.reaction_debut_s ?? 0);
  const meta = await sonderVideoMeta(video.url);
  if (!renduAssezLong(meta.durationSec, dureeReaction)) {
    throw new Error(
      `Kling a tronqué : ${meta.durationSec?.toFixed(2) ?? "?"} s pour une réaction de ${dureeReaction.toFixed(2)} s`,
    );
  }

  const dl = await falDownloadBytes(video.url);
  const propre = mp4SansMetadonnees(dl.bytes);
  const restes = metadonneesMp4(propre);
  if (restes.length) throw new Error(`Métadonnées restantes : ${restes.join(", ")}`);
  const chemin = `ugc/rendus/${id}/reaction.mp4`;
  const url = await deposer(supabase, chemin, propre, "video/mp4");

  const { data: media, error } = await supabase
    .from("media_library")
    .upsert(
      {
        storage_path: chemin,
        url,
        source: "genere_ia",
        tags: ["ai-ugc", "rendu"],
        // L'upscale ne lit que des images : une vidéo n'a rien à y faire.
        upscale_le: new Date().toISOString(),
      },
      { onConflict: "storage_path" },
    )
    .select("id")
    .single();
  if (error || !media) throw new Error(`media_library : ${error?.message ?? "?"}`);

  const moteur = (estMoteurKling(r.moteur) ? r.moteur : MOTEUR_DEFAUT) as MoteurKling;
  await majRendu(supabase, id, {
    statut: "a_valider",
    etape: "fini",
    video_media_id: media.id,
    duree_ms: meta.durationSec ? Math.round(meta.durationSec * 1000) : null,
    cout_usd: coutRendu(moteur, meta.durationSec),
    erreur: null,
  });
}

async function suivreRendus(supabase: Supabase) {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY manquant");
  const { data: enCours, error } = await supabase
    .from("ugc_rendus")
    .select("*")
    .eq("statut", "en_cours")
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) throw new Error(error.message);

  const bilan: Array<{ id: string; etat: string }> = [];
  for (const r of enCours ?? []) {
    const id = String(r.id);
    const age = Date.now() - new Date(String(r.updated_at)).getTime();
    try {
      if (r.etape === "image" || !r.fal_status_url) {
        if (age > IMAGE_ABANDON_MS) {
          await majRendu(supabase, id, { statut: "echec", erreur: "Interrompu avant Kling" });
          bilan.push({ id, etat: "echec" });
        } else bilan.push({ id, etat: "image" });
        continue;
      }
      const st = await fetch(`${r.fal_status_url}?logs=0`, { headers: falAuthHeaders(key) });
      const s = (await st.json()) as { status?: string; error?: unknown };
      if (s.status === "COMPLETED") {
        const res = await fetch(String(r.fal_response_url), { headers: falAuthHeaders(key) });
        const sortie = (await res.json()) as Record<string, unknown>;
        if (!res.ok) throw new Error(`Kling : ${JSON.stringify(sortie).slice(0, 300)}`);
        await finaliserRendu(supabase, r, sortie);
        bilan.push({ id, etat: "a_valider" });
      } else if (s.status === "FAILED" || s.status === "CANCELLED" || !st.ok) {
        throw new Error(`Kling ${s.status ?? st.status} : ${JSON.stringify(s.error ?? s).slice(0, 300)}`);
      } else if (Date.now() - new Date(String(r.kling_soumis_at)).getTime() > KLING_ABANDON_MS) {
        throw new Error("Kling n'a pas rendu en une heure");
      } else {
        bilan.push({ id, etat: String(s.status ?? "?") });
      }
    } catch (e) {
      await majRendu(supabase, id, { statut: "echec", erreur: messageErreur(e) }).catch(() => null);
      bilan.push({ id, etat: "echec" });
    }
  }
  return { suivis: bilan };
}

/* ─── Démos ────────────────────────────────────────────────────────────── */

async function ajouterDemo(supabase: Supabase, chemin: string, langue: string, titre: string) {
  if (!/^ugc\/demos\/[\w./-]+\.mp4$/i.test(chemin) || chemin.includes("..")) {
    throw new Error("chemin attendu : ugc/demos/<fichier>.mp4");
  }
  if (!/^[a-z]{2}$/.test(langue)) throw new Error("langue : code à deux lettres");
  const propre = mp4SansMetadonnees(await lireStorage(supabase, chemin));
  const url = await deposer(supabase, chemin, propre, "video/mp4");
  const meta = await sonderVideoMeta(url);
  const { data: media, error } = await supabase
    .from("media_library")
    .upsert(
      {
        storage_path: chemin,
        url,
        source: "fourni_par_freelance",
        tags: ["ai-ugc", "demo"],
        langue,
        upscale_le: new Date().toISOString(),
      },
      { onConflict: "storage_path" },
    )
    .select("id")
    .single();
  if (error || !media) throw new Error(`media_library : ${error?.message ?? "?"}`);
  const { data, error: e2 } = await supabase
    .from("ugc_demos")
    .insert({
      titre,
      langue,
      media_id: media.id,
      duree_ms: meta.durationSec ? Math.round(meta.durationSec * 1000) : null,
    })
    .select("*")
    .single();
  if (e2) throw new Error(`ugc_demos : ${e2.message}`);
  return { demo: data };
}

/* ─── Entrée ───────────────────────────────────────────────────────────── */

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const refus = await assertAuthorised(request);
  if (refus) return refus;

  const supabase = serviceClient();
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "corps JSON attendu" }, 400);
  }
  const action = String(body.action ?? "");

  try {
    if (action === "persona_brouillon") {
      const urls = Array.isArray(body.urls) ? body.urls.map(String) : [];
      return json({ ok: true, ...(await personaBrouillon(supabase, String(body.cle ?? ""), urls)) });
    }

    if (action === "persona_creer") {
      return json({ ok: true, ...(await personaCreer(supabase, body)) });
    }

    if (action === "modele_importer") {
      const url = normaliserLien(String(body.url ?? ""));
      // Pas de `.or()` : une URL dans un filtre PostgREST se coupe à la virgule.
      const idLien = idVideoTiktok(url);
      const { data: parLien } = await supabase.from("ugc_modeles").select("id").eq("source_url", url).limit(1);
      const { data: parId } = idLien
        ? await supabase.from("ugc_modeles").select("id").eq("tiktok_post_id", idLien).limit(1)
        : { data: [] as Array<{ id: string }> };
      const existant = parLien?.[0] ?? parId?.[0];
      if (existant) return json({ ok: true, id: existant.id, deja: true });
      const { data, error } = await supabase
        .from("ugc_modeles")
        .insert({ source_url: url, titre: "Import en cours…" })
        .select("id")
        .single();
      if (error || !data) throw new Error(`ugc_modeles : ${error?.message ?? "?"}`);
      enArrierePlan(importerModele(supabase, data.id as string, url));
      return json({ ok: true, id: data.id });
    }

    if (action === "modele_couper") {
      const id = String(body.id ?? "");
      const debut = Number(body.debut_s);
      const fin = Number(body.fin_s);
      if (!id || !Number.isFinite(debut) || !Number.isFinite(fin)) {
        return json({ error: "id, debut_s et fin_s requis" }, 400);
      }
      if (!dureeReactionValide(fin - debut)) {
        return json({ error: `La réaction doit durer entre ${REACTION_MIN_S} et ${REACTION_MAX_S} s` }, 400);
      }
      const demo = Number.isFinite(Number(body.demo_debut_s)) ? Number(body.demo_debut_s) : null;
      await majModele(supabase, id, { erreur: null, statut: "a_couper" });
      enArrierePlan(couperModele(supabase, id, debut, fin, demo));
      return json({ ok: true, id });
    }

    if (action === "modele_textes") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "id requis" }, 400);
      const textes: SegmentTexte[] = normaliserTextes(body.textes);
      await majModele(supabase, id, { textes });
      return json({ ok: true, textes });
    }

    if (action === "rendu_lancer") {
      const modeleId = String(body.modele_id ?? "");
      const personaId = String(body.persona_id ?? "");
      const moteur = estMoteurKling(body.moteur) ? body.moteur : MOTEUR_DEFAUT;
      const decor = body.decor === "source" ? "source" : "persona";
      const { data: m } = await supabase.from("ugc_modeles").select("statut").eq("id", modeleId).maybeSingle();
      if (m?.statut !== "pret") return json({ error: "modèle pas prêt (coupe à faire)" }, 400);
      const { data, error } = await supabase
        .from("ugc_rendus")
        .insert({ modele_id: modeleId, persona_id: personaId, moteur, decor })
        .select("id")
        .single();
      if (error?.code === "23505") {
        return json({ error: "Un rendu vivant existe déjà pour ce modèle, ce persona, ce moteur et ce décor" }, 409);
      }
      if (error || !data) throw new Error(`ugc_rendus : ${error?.message ?? "?"}`);
      enArrierePlan(lancerRendu(supabase, data.id as string));
      return json({ ok: true, id: data.id });
    }

    if (action === "rendus_suivre") {
      return json({ ok: true, ...(await suivreRendus(supabase)) });
    }

    if (action === "rendu_decider") {
      const id = String(body.id ?? "");
      const decision = body.decision === "valide" ? "valide" : body.decision === "rejete" ? "rejete" : null;
      if (!id || !decision) return json({ error: "id et decision (valide | rejete) requis" }, 400);
      const { data: r } = await supabase.from("ugc_rendus").select("statut").eq("id", id).maybeSingle();
      if (!r || !["a_valider", "valide", "rejete"].includes(String(r.statut))) {
        return json({ error: "rendu introuvable ou pas encore rendu" }, 400);
      }
      await majRendu(supabase, id, {
        statut: decision,
        motif_rejet: decision === "rejete" ? String(body.motif ?? "").trim() || null : null,
        valide_at: decision === "valide" ? new Date().toISOString() : null,
        valide_par: decision === "valide" ? auteurDe(request) : null,
      });
      return json({ ok: true });
    }

    if (action === "demo_ajouter") {
      return json({
        ok: true,
        ...(await ajouterDemo(
          supabase,
          String(body.chemin ?? ""),
          String(body.langue ?? "").toLowerCase(),
          String(body.titre ?? "").trim(),
        )),
      });
    }

    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    return json({ ok: false, error: messageErreur(e) }, 500);
  }
});
