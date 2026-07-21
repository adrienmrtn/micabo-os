import {
  cleanImage,
  DEFAULT_RELEVANCE_PROMPT,
  DEFAULT_TRANSLATE_PROMPT,
  integrateSophia,
  ocrFrame,
  scoreRelevance,
  translateSlideshow,
  verifyClean,
} from "../_shared/gemini.ts";
import { assertAuthorised, json, serviceClient, todayIso } from "../_shared/supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

const BUCKET = "slideshow-media";
/** cleanImage essaie déjà chaque modèle ; ces tentatives-ci s'étalent sur
 *  plusieurs ticks, pour absorber les refus qui ne se reproduisent pas. */
const MAX_CLEAN_ATTEMPTS = 3;

/**
 * Une Edge Function ne survit pas à un slideshow entier : sept nettoyages
 * d'images d'affilée dépassent largement sa durée de vie (mesuré à 9 min avant
 * d'être tué). On traite donc un nombre borné de slides par appel et on laisse
 * le cron reprendre là où il s'est arrêté à la minute suivante.
 */
const FRAMES_PER_TICK = 2;

/**
 * En dessous, le slideshow part en 'rejected' : une pub Sophia glissée dans un
 * contenu hors sujet se verrait. Seuil volontairement bas au démarrage, à
 * remonter une fois qu'on aura vu ce que la notation donne en vrai.
 */
const RELEVANCE_THRESHOLD = 50;

Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  // Un slideshowId dans le corps cible ce seul slideshow : c'est ce qui permet
  // au bouton « Traiter maintenant » de le mener au bout sans toucher aux autres.
  let onlyId: string | null = null;
  try {
    const body = await request.json();
    onlyId = body?.slideshowId ?? null;
  } catch {
    // Corps vide : mode file d'attente normal.
  }

  try {
    let query = supabase
      .from("slideshows")
      .select("*")
      .in("auto_pipeline_status", ["running", "pending"]);

    if (onlyId) {
      query = query.eq("id", onlyId);
    } else {
      // Un slideshow déjà entamé garde la priorité : on le termine avant d'en
      // ouvrir un nouveau, sinon rien n'aboutit jamais.
      query = query.order("auto_pipeline_status", { ascending: false }).order("created_at");
    }

    const { data: candidates } = await query.limit(1);

    const slideshow = candidates?.[0];
    if (!slideshow) {
      // En mode ciblé, pas de backfill : un test ne doit rien assigner d'autre.
      return json({ ok: true, idle: true, backfilled: onlyId ? 0 : await backfill(supabase) });
    }

    const step = await advanceSlideshow(supabase, slideshow);
    const backfilled = onlyId ? 0 : await backfill(supabase);

    return json({ ok: true, slideshow: slideshow.id, step, backfilled });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ ok: false, error: message }, 500);
  }
});

const DEFAULT_PROMPTS: Record<string, string> = {
  translate: DEFAULT_TRANSLATE_PROMPT,
  relevance: DEFAULT_RELEVANCE_PROMPT,
};

/** Charge un prompt éditable depuis l'admin, avec repli sur le défaut du code. */
async function loadPrompt(supabase: Supabase, key: string): Promise<string> {
  const { data } = await supabase
    .from("sophia_prompts")
    .select("content")
    .eq("key", key)
    .maybeSingle();

  return data?.content?.trim() || DEFAULT_PROMPTS[key] || "";
}

async function setStep(supabase: Supabase, id: string, step: string) {
  await supabase
    .from("slideshows")
    .update({ auto_pipeline_status: "running", auto_pipeline_step: step })
    .eq("id", id);
}

/**
 * Fait avancer un slideshow d'un cran et rend la main. Chaque appel traite au
 * plus FRAMES_PER_TICK slides, puis le cron reprend à la minute suivante.
 * Renvoie l'étape effectuée, pour le journal.
 */
// deno-lint-ignore no-explicit-any
async function advanceSlideshow(supabase: Supabase, slideshow: any): Promise<string> {
  try {
    const { data: frames } = await supabase
      .from("slideshow_frames")
      .select("*")
      .eq("slideshow_id", slideshow.id)
      .order("position");

    if (!frames || frames.length === 0) throw new Error("Slideshow sans slide");

    const context = slideshow.title ?? "";

    // 0 — pertinence, avant toute dépense de nettoyage ou de traduction.
    //
    // À ce stade rien n'est encore traduit : on note sur la légende du post,
    // seul signal disponible. Un slideshow recalé reste en base, visible dans
    // l'admin, rattrapable à la main.
    if (slideshow.relevance_score === null) {
      await setStep(supabase, slideshow.id, "scoring");
      const { score, reason } = await scoreRelevance({
        caption: context,
        hookText: "",
        instructions: await loadPrompt(supabase, "relevance"),
      });

      if (score < RELEVANCE_THRESHOLD) {
        await supabase
          .from("slideshows")
          .update({
            relevance_score: score,
            relevance_reason: reason,
            auto_pipeline_status: "rejected",
            auto_pipeline_step: null,
          })
          .eq("id", slideshow.id);
        return "rejected";
      }

      await supabase
        .from("slideshows")
        .update({ relevance_score: score, relevance_reason: reason })
        .eq("id", slideshow.id);
      return "scoring";
    }

    // 1 — nettoyage des slides restantes, par petits lots.
    const toClean = frames.filter(
      (frame) =>
        frame.original_url &&
        frame.clean_status !== "done" &&
        frame.clean_status !== "failed",
    );

    if (toClean.length > 0) {
      await setStep(supabase, slideshow.id, "cleaning");
      for (const frame of toClean.slice(0, FRAMES_PER_TICK)) {
        await cleanFrame(supabase, slideshow.id, slideshow.tiktok_account_id, frame);
      }
      return "cleaning";
    }

    // 2 — OCR, slide par slide, sur l'image d'ORIGINE (le nettoyage vient d'en
    // retirer le texte). `=== null` et non falsy : un OCR vide est une tentative
    // aboutie, le re-tester bouclerait à l'infini.
    const toOcr = frames.filter(
      (frame) => frame.extracted_text === null && frame.original_url,
    );

    if (toOcr.length > 0) {
      await setStep(supabase, slideshow.id, "ocr");
      for (const frame of toOcr.slice(0, FRAMES_PER_TICK)) {
        const extracted = await ocrFrame(frame.original_url);
        await supabase
          .from("slideshow_frames")
          .update({ extracted_text: extracted })
          .eq("id", frame.id);
      }
      return "ocr";
    }

    // 3 — traduction de TOUT le deck en une passe : seule façon de tenir la
    // persona et le genre d'une slide à l'autre, comme l'exige le prompt.
    const needsTranslation = frames.some((frame) => frame.translated_text === null);
    if (needsTranslation) {
      await setStep(supabase, slideshow.id, "translating");
      const translations = await translateSlideshow({
        slides: frames.map((f) => ({ position: f.position, original: f.extracted_text ?? "" })),
        sourceTitle: context,
        rules: await loadPrompt(supabase, "translate"),
      });

      const byPosition = new Map(translations.map((t) => [t.position, t.translated]));
      for (const frame of frames) {
        await supabase
          .from("slideshow_frames")
          .update({ translated_text: byPosition.get(frame.position) ?? "" })
          .eq("id", frame.id);
      }
      return "translating";
    }

    // 4 — placement de Sophia : remplace un conseil par une version où Sophia
    // est la réponse, en 3 variantes.
    await setStep(supabase, slideshow.id, "sophia");
    await generateSophia(supabase, slideshow.id, context);

    // 4 — assignation au poster du compte de référence.
    await setStep(supabase, slideshow.id, "assigning");
    await assign(supabase, slideshow);

    await supabase
      .from("slideshows")
      .update({
        auto_pipeline_status: "done",
        auto_pipeline_step: null,
        auto_pipeline_error: null,
      })
      .eq("id", slideshow.id);

    return "done";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from("slideshows")
      .update({ auto_pipeline_status: "failed", auto_pipeline_error: message })
      .eq("id", slideshow.id);
    return "failed";
  }
}

// deno-lint-ignore no-explicit-any
async function cleanFrame(
  supabase: Supabase,
  slideshowId: string,
  accountId: string | null,
  frame: any,
) {
  const attempts = (frame.clean_attempts ?? 0) + 1;
  const exhausted = attempts >= MAX_CLEAN_ATTEMPTS;

  try {
    const base64 = await cleanImage(frame.original_url);

    if (!base64) {
      // Le modèle a refusé la retouche. Tant qu'il reste des tentatives on
      // repassera ; une fois épuisées, on substitue une image de bibliothèque
      // plutôt que de livrer la slide avec son texte d'origine incrusté.
      await handleCleanFailure(supabase, accountId, frame, attempts, exhausted);
      return;
    }

    const isClean = await verifyClean(base64, "image/png");
    if (!isClean && !exhausted) {
      await supabase
        .from("slideshow_frames")
        .update({ clean_attempts: attempts })
        .eq("id", frame.id);
      return;
    }

    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const path = `${slideshowId}/${frame.position}.png`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });

    if (uploadError) throw uploadError;

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    await supabase
      .from("slideshow_frames")
      .update({
        cleaned_url: publicUrl,
        clean_status: "done",
        clean_attempts: attempts,
        image_source: "cleaned",
      })
      .eq("id", frame.id);

    // Une slide nettoyée est un fond vierge réutilisable : elle alimente la
    // bibliothèque du compte pour les prochaines substitutions.
    if (accountId) {
      await supabase.from("account_images").insert({
        tiktok_account_id: accountId,
        storage_path: path,
        public_url: publicUrl,
        kind: "slide_background",
        source: "cleaned_slide",
      });
    }
  } catch (_error) {
    await handleCleanFailure(supabase, accountId, frame, attempts, exhausted);
  }
}

/**
 * Tentatives épuisées : on remplace le visuel par une image de la bibliothèque
 * du compte (la moins utilisée d'abord). Sans bibliothèque disponible, la slide
 * est marquée `failed` — l'admin la verra dans sa file plutôt que de la
 * découvrir chez un poster.
 */
// deno-lint-ignore no-explicit-any
async function handleCleanFailure(
  supabase: Supabase,
  accountId: string | null,
  frame: any,
  attempts: number,
  exhausted: boolean,
) {
  if (!exhausted) {
    await supabase
      .from("slideshow_frames")
      .update({ clean_attempts: attempts })
      .eq("id", frame.id);
    return;
  }

  const { data: candidates } = await supabase
    .from("account_images")
    .select("id, public_url, used_count")
    .eq("kind", "slide_background")
    .or(accountId ? `tiktok_account_id.eq.${accountId},tiktok_account_id.is.null` : "tiktok_account_id.is.null")
    .order("used_count")
    .limit(1);

  const replacement = candidates?.[0];

  if (!replacement) {
    await supabase
      .from("slideshow_frames")
      .update({ clean_status: "failed", clean_attempts: attempts })
      .eq("id", frame.id);
    return;
  }

  await supabase
    .from("slideshow_frames")
    .update({
      cleaned_url: replacement.public_url,
      clean_status: "done",
      clean_attempts: attempts,
      image_source: "library",
    })
    .eq("id", frame.id);

  await supabase
    .from("account_images")
    .update({ used_count: replacement.used_count + 1 })
    .eq("id", replacement.id);
}

/**
 * Remplace l'un des conseils du slideshow par une version où Sophia est la
 * réponse. Le modèle voit toutes les slides pour choisir la plus substituable
 * et calquer le format des autres ; le texte d'origine est conservé dans
 * sophia_variants pour l'affichage admin et le retour arrière.
 */
async function generateSophia(supabase: Supabase, slideshowId: string, context: string) {
  const { data: existing } = await supabase
    .from("sophia_variants")
    .select("id")
    .eq("slideshow_id", slideshowId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { data: prompt } = await supabase
    .from("sophia_prompts")
    .select("content")
    .eq("key", "master")
    .single();

  const { data: corrections } = await supabase
    .from("sophia_corrections")
    .select("original_text, corrected_text")
    .order("created_at", { ascending: false })
    .limit(40);

  const { data: frames } = await supabase
    .from("slideshow_frames")
    .select("id, position, translated_text")
    .eq("slideshow_id", slideshowId)
    .order("position");

  if (!frames || frames.length < 2) return;

  const placement = await integrateSophia({
    masterPrompt: prompt?.content ?? "",
    corrections: corrections ?? [],
    slides: frames.map((f) => ({
      position: f.position,
      text: f.translated_text ?? "",
    })),
    caption: context,
  });

  if (!placement) return;

  const target = frames.find((f) => f.position === placement.chosenPosition);
  if (!target) return;

  // Le modèle a désigné la meilleure des 3 selon le prompt ; c'est elle qu'on
  // applique. Les 2 autres restent en base pour trace et retour arrière.
  const best = placement.bestIndex;
  const rows = placement.variants.map((text, index) => ({
    slideshow_id: slideshowId,
    frame_id: target.id,
    text,
    original_text: target.translated_text,
    chosen: index === best,
  }));
  await supabase.from("sophia_variants").insert(rows);

  // Le poster lit slideshow_frames : le texte retenu atterrit donc là.
  await supabase
    .from("slideshow_frames")
    .update({ translated_text: placement.variants[best], is_sophia_slide: true })
    .eq("id", target.id);
}

/**
 * Assigne le slideshow au poster du compte de référence, pour le premier jour
 * où il n'a encore rien sur ce compte. L'index unique (poster, compte, date)
 * garantit qu'on ne double jamais une journée.
 */
// deno-lint-ignore no-explicit-any
async function assign(supabase: Supabase, slideshow: any) {
  if (!slideshow.tiktok_account_id) return;

  const { data: assignment } = await supabase
    .from("assignments")
    .select("poster_id")
    .eq("tiktok_account_id", slideshow.tiktok_account_id)
    .maybeSingle();

  if (!assignment) return;

  const { data: taken } = await supabase
    .from("slideshows")
    .select("assigned_date")
    .eq("poster_id", assignment.poster_id)
    .eq("tiktok_account_id", slideshow.tiktok_account_id)
    .not("assigned_date", "is", null);

  const takenDates = new Set((taken ?? []).map((row) => row.assigned_date));

  const date = new Date();
  for (let offset = 0; offset < 60; offset += 1) {
    const iso = date.toISOString().slice(0, 10);
    if (!takenDates.has(iso)) {
      await supabase
        .from("slideshows")
        .update({ poster_id: assignment.poster_id, assigned_date: iso })
        .eq("id", slideshow.id);
      return;
    }
    date.setDate(date.getDate() + 1);
  }
}

/**
 * Filet de sécurité : si un poster n'a rien pour aujourd'hui sur un compte
 * assigné, on lui redonne un slideshow déjà validé plutôt que de le laisser
 * sans rien à publier.
 */
async function backfill(supabase: Supabase): Promise<number> {
  const today = todayIso();
  let count = 0;

  const { data: assignments } = await supabase
    .from("assignments")
    .select("poster_id, tiktok_account_id");

  for (const assignment of assignments ?? []) {
    const { data: todays } = await supabase
      .from("slideshows")
      .select("id")
      .eq("poster_id", assignment.poster_id)
      .eq("tiktok_account_id", assignment.tiktok_account_id)
      .eq("assigned_date", today)
      .limit(1);

    if (todays && todays.length > 0) continue;

    const { data: reusable } = await supabase
      .from("slideshows")
      .select("id")
      .eq("tiktok_account_id", assignment.tiktok_account_id)
      .eq("auto_pipeline_status", "done")
      .is("posted_at", null)
      .is("assigned_date", null)
      .order("created_at")
      .limit(1);

    if (!reusable || reusable.length === 0) continue;

    await supabase
      .from("slideshows")
      .update({ poster_id: assignment.poster_id, assigned_date: today })
      .eq("id", reusable[0].id);

    count += 1;
  }

  return count;
}
