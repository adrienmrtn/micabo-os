import {
  cleanImage,
  contientVisageIdentifiable,
  ocrFrame,
  scoreRelevance,
  verifyClean,
} from "../_shared/gemini.ts";
import { assertAuthorised, chargerPrompt, json, serviceClient } from "../_shared/supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

const BUCKET = "medias";
/** Une Edge Function ne tient pas trente appels Gemini : on avance par petits
 *  lots et le cron reprend là où on s'est arrêté. */
const SLIDES_PAR_PASSAGE = 2;
const SEUIL_PERTINENCE = 50;
const TENTATIVES_NETTOYAGE = 3;

interface Slide {
  position: number;
  raw_url: string;
  texte_original: string | null;
  media_id: string | null;
}

/**
 * Préparation d'un sujet : OCR des visuels, notation de pertinence, puis
 * nettoyage des images vers la bibliothèque. Un sujet jugé hors-sujet est
 * rejeté avant tout nettoyage, ce qui évite de payer du Gemini pour rien.
 *
 *   {}            → le sujet le plus ancien restant à préparer
 *   { sujetId }   → ce sujet précis (essai admin)
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  let sujetId: string | null = null;
  try {
    const body = await request.json();
    sujetId = body?.sujetId ?? null;
  } catch {
    // Corps vide : on prend la file.
  }

  try {
    let query = supabase
      .from("sujets")
      .select("*")
      .in("preparation_statut", ["running", "pending"]);

    if (sujetId) query = query.eq("id", sujetId);
    else query = query.order("preparation_statut", { ascending: false }).order("created_at");

    const { data: sujets } = await query.limit(1);
    const sujet = sujets?.[0];
    if (!sujet) return json({ ok: true, idle: true });

    const etape = await avancer(supabase, sujet);
    return json({ ok: true, sujetId: sujet.id, etape });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function avancer(supabase: Supabase, sujet: any): Promise<string> {
  const slides: Slide[] = sujet.structure_slides ?? [];

  try {
    if (slides.length === 0) throw new Error("Sujet sans visuel");

    await supabase
      .from("sujets")
      .update({ preparation_statut: "running" })
      .eq("id", sujet.id);

    // 1 — OCR sur le visuel BRUT : c'est la seule version qui porte encore le
    // texte, le nettoyage vient justement l'effacer.
    const aOcr = slides.filter((s) => s.texte_original === null);
    if (aOcr.length > 0) {
      for (const slide of aOcr.slice(0, SLIDES_PAR_PASSAGE)) {
        slide.texte_original = await ocrFrame(slide.raw_url);
      }
      await supabase
        .from("sujets")
        .update({ structure_slides: slides })
        .eq("id", sujet.id);
      return "ocr";
    }

    // 2 — pertinence, une fois les textes connus, avant toute dépense d'image.
    if (sujet.pertinence_score === null) {
      const accroche = slides[0]?.texte_original ?? "";
      const { score, reason } = await scoreRelevance({
        caption: sujet.titre ?? "",
        hookText: accroche,
        instructions: await chargerPrompt(supabase, "pertinence"),
      });

      const retenu = score >= SEUIL_PERTINENCE;
      await supabase
        .from("sujets")
        .update({
          pertinence_score: score,
          pertinence_raison: reason,
          statut: retenu ? "retenu" : "rejete",
          preparation_statut: retenu ? "running" : "done",
        })
        .eq("id", sujet.id);

      return retenu ? "pertinence" : "rejete";
    }

    // 3 — nettoyage des visuels retenus, versés dans la bibliothèque.
    const aNettoyer = slides.filter((s) => s.media_id === null);
    if (aNettoyer.length > 0) {
      for (const slide of aNettoyer.slice(0, SLIDES_PAR_PASSAGE)) {
        slide.media_id = await nettoyerVersBibliotheque(supabase, sujet, slide);
      }
      await supabase
        .from("sujets")
        .update({ structure_slides: slides })
        .eq("id", sujet.id);
      return "nettoyage";
    }

    await supabase
      .from("sujets")
      .update({ preparation_statut: "done", preparation_erreur: null })
      .eq("id", sujet.id);
    return "done";
  } catch (error) {
    await supabase
      .from("sujets")
      .update({
        preparation_statut: "failed",
        preparation_erreur: error instanceof Error ? error.message : String(error),
      })
      .eq("id", sujet.id);
    return "failed";
  }
}

/**
 * Nettoie un visuel et l'ajoute à la bibliothèque. Le modèle refuse parfois la
 * retouche ; on réessaie, et en dernier recours on verse l'original — un visuel
 * exploitable vaut mieux qu'un trou dans la bibliothèque, et le champ
 * `visage_identifiable` protège de toute façon l'usage en avatar.
 */
// deno-lint-ignore no-explicit-any
async function nettoyerVersBibliotheque(
  supabase: Supabase,
  sujet: any,
  slide: Slide,
): Promise<string | null> {
  let propreBase64: string | null = null;

  for (let essai = 0; essai < TENTATIVES_NETTOYAGE && !propreBase64; essai += 1) {
    const candidat = await cleanImage(slide.raw_url);
    if (!candidat) continue;
    if (await verifyClean(candidat, "image/png")) propreBase64 = candidat;
    else if (essai === TENTATIVES_NETTOYAGE - 1) propreBase64 = candidat;
  }

  const path = `propre/${sujet.id}/${slide.position}.png`;
  let url: string;

  if (propreBase64) {
    const bytes = Uint8Array.from(atob(propreBase64), (c) => c.charCodeAt(0));
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (error) throw error;
    url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } else {
    url = slide.raw_url;
  }

  // Le doute vaut refus : null (indécis) sera traité comme « visage présent »
  // par la sélection d'avatar.
  const visage = await contientVisageIdentifiable(url);

  const { data: media, error } = await supabase
    .from("media_library")
    .insert({
      compte_reference_id: sujet.compte_reference_id,
      storage_path: propreBase64 ? path : `brut/${sujet.id}/${slide.position}`,
      url,
      source: "nettoye_reference",
      langue: sujet.langue,
      visage_identifiable: visage === null ? true : visage,
    })
    .select()
    .single();

  if (error) throw error;
  return media.id;
}
