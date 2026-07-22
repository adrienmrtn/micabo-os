import {
  cleanImage,
  RefusRetouche,
  ocrFrame,
  scoreRelevance,
  verifyClean,
} from "../_shared/gemini.ts";
import { assertAuthorised, chargerPrompt, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

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
    return json({ ok: false, error: messageErreur(error) }, 500);
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
        // On enregistre slide par slide, pas à la fin du lot : le worker est
        // régulièrement tué en cours de route (WORKER_RESOURCE_LIMIT), et le
        // média était alors déjà en base sans que son id soit retenu. Le
        // passage suivant reprenait la même slide et butait sur l'unicité de
        // storage_path, ce qui condamnait le sujet.
        await supabase
          .from("sujets")
          .update({ structure_slides: slides })
          .eq("id", sujet.id);
      }
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
        preparation_erreur: messageErreur(error),
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
    let candidat: string | null;
    try {
      candidat = await cleanImage(slide.raw_url);
    } catch (error) {
      if (error instanceof RefusRetouche) {
        // Un refus ne se retente pas : le modèle répondra pareil. On garde
        // l'original — le visuel reste exploitable, texte incrusté compris —
        // et on trace le motif, seul moyen de savoir ce qui bloque vraiment.
        console.warn(`[nettoyage refusé] sujet=${sujet.id} slide=${slide.position} ${error.message}`);
        break;
      }
      throw error;
    }

    if (!candidat) continue;
    // On ne retient QUE si la vérification confirme l'absence de texte. Garder
    // la dernière tentative « faute de mieux » remplissait la bibliothèque de
    // visuels rangés dans propre/ — donc marqués « Nettoyé » — qui portaient
    // encore leur texte. Mieux vaut honnêtement garder l'original (brut/) : au
    // moins il est signalé comme non nettoyé côté poster et côté admin.
    if (await verifyClean(candidat, "image/png")) propreBase64 = candidat;
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

  // La détection de visage ne servait qu'au choix d'une photo de profil — une
  // fois par compte — mais tournait sur CHAQUE slide préparée, soit un appel
  // facturé sur des centaines de visuels qui ne deviendront jamais un avatar.
  // On laisse le champ à null : la sélection d'avatar traite déjà l'indécision
  // comme « visage présent », donc elle reste prudente par défaut et fera le
  // test elle-même, sur la poignée de photos qu'elle examine.

  // Upsert et non insert : `storage_path` est unique, et une reprise après un
  // worker tué retomberait sinon sur un doublon. Le chemin identifie déjà le
  // visuel de façon stable, réécrire la ligne est sans effet de bord.
  const { data: media, error } = await supabase
    .from("media_library")
    .upsert(
      {
        compte_reference_id: sujet.compte_reference_id,
        storage_path: propreBase64 ? path : `brut/${sujet.id}/${slide.position}`,
        url,
        source: "nettoye_reference",
        langue: sujet.langue,
        visage_identifiable: null,
      },
      { onConflict: "storage_path" },
    )
    .select()
    .single();

  if (error) throw error;
  return media.id;
}
