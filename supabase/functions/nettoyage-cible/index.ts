/**
 * Nettoyage CIBLÉ d'un slideshow (02/10/2026) : effacer la légende ajoutée,
 * garder tout ce qui porte le sens de l'image.
 *
 *   { contenuId, positions?, consignes?: { [position]: string }, ecrire?, promouvoir?,
 *     depuis?: "brut" | "propre", effacer?, garder? } → 202 { ok }
 *   puis une ligne par slide dans `nettoyage_cible`
 *
 * Pourquoi : le nettoyage de l'import (`cleanImage`, text-removal) efface TOUT
 * ce qui ressemble à du texte. Sur flashka_es, les slides reposent sur des
 * vignettes : le logo de l'IA notée (ChatGPT, Gemini, Meta AI) en haut à gauche
 * et une copie notée (5/10, 4/10, 3/10, 10/10, 100 %) en haut à droite. Le
 * texte ajouté n'est qu'une courte légende entre les deux (« Burlas... 😭 »).
 * Sur les quatre slideshows flashka déjà validés, le nettoyage avait effacé le
 * logo, la note et les copies : il ne restait qu'un selfie.
 *
 * Ici, un modèle de vision localise séparément ce qu'il faut EFFACER et ce
 * qu'il faut GARDER ; une zone à effacer qui mord sur une zone à garder est
 * rognée du côté qui lui coûte le moins, et abandonnée s'il n'en reste pas
 * assez. L'effaceur de Fal (`fal-ai/bria/eraser`) ne reconstruit que sous le
 * masque : le reste de l'image ne bouge pas.
 *
 * `ecrire: false` (défaut) range le résultat sous `essai/nettoyage-cible/…`,
 * pour le relire avant d'en décider. `ecrire: true` le range au chemin du
 * propre (`propre/<contenu>/<position>.<ext>`) avec sa ligne `media_library`,
 * que l'import reprend tel quel (`trouverPropreExistant`) au lieu de
 * renettoyer. `promouvoir: true` fait la même écriture à partir du dernier essai
 * relu, sans repayer la lecture ni l'effacement. Les images portent
 * `exclu_concurrent` : elles montrent des marques tierces et ne doivent garnir
 * aucun autre slideshow.
 *
 * `depuis: "propre"` (emir.study, 02/10) part de l'image que l'import a déjà
 * nettoyée et agrandie, pas du brut : on n'y efface qu'un reste précis (le logo
 * « astra AI » posé sur la slide qui fait la pub de l'appli). `effacer` et
 * `garder` remplacent alors les consignes par défaut, écrites pour flashka.
 * Si le chemin écrit n'est pas celui de l'image en place (l'import écrit du
 * `.jpg`, l'effaceur rend du `.png`), la slide est repointée par
 * `patch_contenu_slide_media` — sinon elle garderait l'ancienne image — et
 * l'ancienne ligne passe `exclu_concurrent` : elle porte encore le logo, elle
 * ne doit garnir aucun slideshow.
 */

import { callWithFallback, fetchImageAsInline, MODELES_LECTURE_BURN, textOf, TEXT_MODELS } from "../_shared/gemini.ts";
import { effacerSousMasqueFal } from "../_shared/fal_eraser.ts";
import { masqueSur, zonesNommees } from "../_shared/nettoyage_cible.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

type Slide = { position: number; raw_url?: string | null; texte_original?: string | null; media_id?: string | null };
type Options = { depuis: "brut" | "propre"; effacer: string; garder: string };

const BUCKET = "medias";

const EFFACER_DEFAUT =
  "le texte de légende AJOUTÉ par-dessus la photo (police d'application, souvent blanc à contour noir, parfois sur fond coloré), avec les emojis qui l'accompagnent ; le logo ou le nom d'une appli de flashcards concurrente (vignette « flashka » : icône jaune et violette + mot flashka) ; un filigrane ou un pseudo";
const GARDER_DEFAUT =
  "les logos d'IA en vignette (ChatGPT, Gemini, Meta AI…), les vignettes, copies ou feuilles qui portent une note (5/10, 10/10, 100 %…), la photo elle-même, les personnes, le badge, les objets et le décor";

function consigne(effacer: string, garder: string, ocr: string, extra: string): string {
  return `Tu prépares le nettoyage d'une slide de slideshow TikTok. Un outil va effacer des rectangles de l'image et reconstruire le décor dessous. Tout ce qui est hors des rectangles restera intact.

À EFFACER : ${effacer}.
À GARDER, sans y toucher : ${garder}.
${extra ? `Pour cette slide en particulier : ${extra}\n` : ""}
Texte lu sur la slide (OCR, tous éléments confondus) : « ${ocr || "(rien)"} ». Une partie de ce texte peut appartenir à un élément à garder (le nom dans un logo, une note sur une copie) : ce texte-là reste.

Donne :
- "effacer" : un rectangle par élément à effacer, qui l'englobe entièrement avec une petite marge ;
- "garder" : un rectangle par élément à garder qui se trouve PRÈS d'un élément à effacer (logo, vignette, note) — pas la photo entière.
Coordonnées en FRACTIONS de 0 à 1 de la largeur et de la hauteur, origine en haut à gauche.

Réponds en JSON strict, rien d'autre :
{"effacer":[{"x":0,"y":0,"w":0,"h":0,"quoi":"…"}],"garder":[{"x":0,"y":0,"w":0,"h":0,"quoi":"…"}]}`;
}

function format(octets: Uint8Array): { mime: string; ext: string } {
  if (octets[0] === 0x89 && octets[1] === 0x50) return { mime: "image/png", ext: "png" };
  if (octets[0] === 0x52 && octets[1] === 0x49) return { mime: "image/webp", ext: "webp" };
  return { mime: "image/jpeg", ext: "jpg" };
}

async function nettoyerUne(
  supabase: ReturnType<typeof serviceClient>,
  // deno-lint-ignore no-explicit-any
  contenu: any,
  slide: Slide,
  extra: string,
  ecrire: boolean,
  opts: Options,
): Promise<Record<string, unknown>> {
  let raw = slide.raw_url ?? "";
  let enPlace: { id: string; storage_path: string } | null = null;
  if (opts.depuis === "propre") {
    if (!slide.media_id) throw new Error("pas d'image propre en place");
    const { data: m, error: em } = await supabase
      .from("media_library")
      .select("id, url, storage_path")
      .eq("id", slide.media_id)
      .maybeSingle();
    if (em) throw em;
    if (!m?.url) throw new Error(`média ${slide.media_id} introuvable`);
    raw = m.url as string;
    enPlace = { id: m.id as string, storage_path: m.storage_path as string };
  }
  if (!raw) throw new Error("pas d'image brute");
  const image = await fetchImageAsInline(raw);
  // Sur le propre, la légende est déjà partie : l'OCR du brut égarerait la lecture.
  const ocr = opts.depuis === "propre" ? "" : (slide.texte_original ?? "").replace(/\n/g, " / ");
  const lu = textOf(await callWithFallback([...MODELES_LECTURE_BURN, ...TEXT_MODELS], [
    { text: consigne(opts.effacer, opts.garder, ocr, extra) },
    image,
  ]));
  const m = lu.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`lecture sans JSON : ${lu.slice(0, 160)}`);
  const brut = JSON.parse(m[0]) as { effacer?: unknown; garder?: unknown };
  const aEffacer = zonesNommees(brut.effacer);
  const aGarder = zonesNommees(brut.garder);
  const { retenues, notes } = masqueSur(aEffacer, aGarder);
  const base = { depuis: opts.depuis, effacer: aEffacer, garder: aGarder, retenues, notes };
  if (retenues.length === 0) return { ...base, statut: "rien_a_effacer" };

  const b64 = image.inline_data?.data ?? "";
  const octetsBruts = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  let octets: Uint8Array;
  try {
    octets = await effacerSousMasqueFal(raw, octetsBruts, retenues);
  } catch (e) {
    // Les zones lues restent dans le journal : c'est ce qu'on relit pour comprendre.
    return { ...base, statut: "erreur", erreur: messageErreur(e).slice(0, 1000) };
  }
  const { mime, ext } = format(octets);

  const chemin = ecrire
    ? `propre/${contenu.id}/${slide.position}.${ext}`
    : `essai/nettoyage-cible/${contenu.id}/${slide.position}.${ext}`;
  const { error: up } = await supabase.storage.from(BUCKET).upload(chemin, octets, {
    contentType: mime,
    upsert: true,
    cacheControl: "0",
  });
  if (up) throw up;
  const url = `${supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl}?v=${Date.now()}`;
  if (!ecrire) return { ...base, statut: "essai", chemin, url };

  const mediaId = await enregistrerPropre(supabase, contenu, chemin, url);
  const remplace = await repointer(supabase, contenu.id, slide, mediaId, enPlace);
  return { ...base, statut: "ecrit", chemin, url, media_id: mediaId, ...(remplace ? { remplace } : {}) };
}

/**
 * La slide doit montrer ce qu'on vient d'écrire. Même chemin → même ligne,
 * rien à faire. Chemin différent → on repointe la slide (RPC atomique, deux
 * positions tournent en parallèle) et l'ancienne image sort des pools.
 */
async function repointer(
  supabase: ReturnType<typeof serviceClient>,
  contenuId: string,
  slide: Slide,
  mediaId: string,
  enPlace: { id: string; storage_path: string } | null,
): Promise<string | null> {
  const ancien = enPlace?.id ?? slide.media_id ?? null;
  if (ancien === mediaId) return null;
  const { error } = await supabase.rpc("patch_contenu_slide_media", {
    p_contenu_id: contenuId,
    p_position: slide.position,
    p_media_id: mediaId,
    p_clear_tentatives: true,
  });
  if (error) throw error;
  if (ancien) {
    const { error: ex } = await supabase.from("media_library").update({ exclu_concurrent: true }).eq("id", ancien);
    if (ex) throw ex;
  }
  return ancien;
}

/** La ligne `media_library` du propre, comme l'import l'écrit — plus `exclu_concurrent`. */
async function enregistrerPropre(
  supabase: ReturnType<typeof serviceClient>,
  // deno-lint-ignore no-explicit-any
  contenu: any,
  chemin: string,
  url: string,
): Promise<string> {
  const { data: media, error } = await supabase
    .from("media_library")
    .upsert({
      compte_reference_id: contenu.compte_reference_id,
      contenu_id: contenu.id,
      application_id: contenu.application_id ?? undefined,
      storage_path: chemin,
      url,
      source: "nettoye_reference",
      langue: contenu.langue_source,
      visage_identifiable: null,
      verifie_le: new Date().toISOString(),
      texte_restant: false,
      exclu_concurrent: true,
    }, { onConflict: "storage_path" })
    .select("id")
    .single();
  if (error) throw error;
  return media.id as string;
}

/**
 * Promotion d'un essai déjà relu : copie le fichier d'essai au chemin du propre
 * et écrit sa ligne `media_library`, sans repayer la lecture ni l'effacement.
 */
async function promouvoirUne(
  supabase: ReturnType<typeof serviceClient>,
  // deno-lint-ignore no-explicit-any
  contenu: any,
  position: number,
): Promise<Record<string, unknown>> {
  const { data: essai } = await supabase
    .from("nettoyage_cible")
    .select("resultat")
    .eq("contenu_id", contenu.id)
    .eq("position", position)
    .eq("resultat->>statut", "essai")
    .order("fait_le", { ascending: false })
    .limit(1)
    .maybeSingle();
  const source = (essai?.resultat as { chemin?: string } | undefined)?.chemin;
  if (!source) throw new Error("aucun essai à promouvoir");
  const ext = source.split(".").pop() ?? "png";
  const chemin = `propre/${contenu.id}/${position}.${ext}`;
  const { error: cp } = await supabase.storage.from(BUCKET).copy(source, chemin);
  if (cp) throw cp;
  const url = `${supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl}?v=${Date.now()}`;
  const mediaId = await enregistrerPropre(supabase, contenu, chemin, url);
  const slide = ((contenu.structure_slides ?? []) as Slide[]).find((s) => Number(s.position) === position)
    ?? { position };
  const remplace = await repointer(supabase, contenu.id, slide, mediaId, null);
  return { statut: "ecrit", depuis: source, chemin, url, media_id: mediaId, ...(remplace ? { remplace } : {}) };
}

Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;
  try {
    const corps = await request.json().catch(() => ({}));
    const contenuId = String(corps?.contenuId ?? "").trim();
    const ecrire = corps?.ecrire === true;
    const promouvoir = corps?.promouvoir === true;
    const positions: number[] | null = Array.isArray(corps?.positions) ? corps.positions.map(Number) : null;
    const consignes = (corps?.consignes && typeof corps.consignes === "object" ? corps.consignes : {}) as Record<string, string>;
    const opts: Options = {
      depuis: corps?.depuis === "propre" ? "propre" : "brut",
      effacer: typeof corps?.effacer === "string" && corps.effacer.trim() ? corps.effacer.trim() : EFFACER_DEFAUT,
      garder: typeof corps?.garder === "string" && corps.garder.trim() ? corps.garder.trim() : GARDER_DEFAUT,
    };
    if (!contenuId) return json({ ok: false, error: "contenuId manquant" }, 400);

    const supabase = serviceClient();
    const { data: contenu, error } = await supabase
      .from("contenus")
      .select("id, compte_reference_id, application_id, langue_source, structure_slides")
      .eq("id", contenuId)
      .single();
    if (error || !contenu) return json({ ok: false, error: "contenu introuvable" }, 404);
    const slides = ((contenu.structure_slides ?? []) as Slide[])
      .filter((s) => !positions || positions.includes(Number(s.position)));

    const travail = (async () => {
      let i = 0;
      async function suivant(): Promise<void> {
        while (i < slides.length) {
          const s = slides[i++];
          let ligne: Record<string, unknown>;
          try {
            ligne = promouvoir
              ? await promouvoirUne(supabase, contenu, Number(s.position))
              : await nettoyerUne(supabase, contenu, s, String(consignes[String(s.position)] ?? ""), ecrire, opts);
          } catch (e) {
            ligne = { statut: "erreur", erreur: messageErreur(e).slice(0, 1000) };
          }
          await supabase.from("nettoyage_cible").insert({
            contenu_id: contenuId,
            position: s.position,
            ecrit: ligne.statut === "ecrit",
            resultat: ligne,
          });
        }
      }
      await Promise.all([suivant(), suivant()]);
    })();
    const edge = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edge) edge.waitUntil(travail);
    else await travail;
    return json({ ok: true, contenuId, slides: slides.length, ecrire }, 202);
  } catch (e) {
    return json({ ok: false, error: messageErreur(e) }, 500);
  }
});
