/**
 * Décrire des images avant d'agir dessus (02/10/2026) — LECTURE SEULE.
 *
 *   { images: [{ url, contexte? }], question, modeles? } → { ok, reponses: [{ url, reponse | erreur }] }
 *
 * L'environnement de travail ne joint pas le Storage : pour savoir ce que porte
 * une image (logo, note, capture, texte ajouté) avant de décider d'un
 * nettoyage ou d'un garnissage, on la fait décrire. `contexte` (le texte OCR de
 * la slide, par exemple) part avec chaque image. N'écrit nulle part.
 *
 * Les modèles par défaut sont ceux de la lecture du burn : la description doit
 * être précise sur la position et la nature de chaque élément, c'est le métier
 * qu'on leur a déjà confié.
 */

import { callWithFallback, fetchImageAsInline, MODELES_LECTURE_BURN, textOf, TEXT_MODELS } from "../_shared/gemini.ts";
import { assertAuthorised, json, messageErreur } from "../_shared/supabase.ts";

const PARALLELE = 3;
const STORAGE = "https://qkmiwnmiwsvwkttldqgb.supabase.co/storage/v1/object/public/";

Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;
  try {
    const corps = await request.json().catch(() => ({}));
    const question = String(corps?.question ?? "").trim();
    const images = (Array.isArray(corps?.images) ? corps.images : [])
      .slice(0, 12)
      .map((i: { url?: unknown; contexte?: unknown }) => ({ url: String(i?.url ?? ""), contexte: String(i?.contexte ?? "") }));
    if (!question || images.length === 0) return json({ ok: false, error: "question ou images manquantes" }, 400);
    if (images.some((i: { url: string }) => !i.url.startsWith(STORAGE))) {
      return json({ ok: false, error: "seules les images de notre Storage sont lues" }, 400);
    }
    const modeles = Array.isArray(corps?.modeles) && corps.modeles.length > 0
      ? corps.modeles.map(String)
      : [...MODELES_LECTURE_BURN, ...TEXT_MODELS];

    const reponses: Array<Record<string, unknown>> = new Array(images.length);
    let i = 0;
    async function suivant(): Promise<void> {
      while (i < images.length) {
        const k = i++;
        const { url, contexte } = images[k];
        try {
          const image = await fetchImageAsInline(url);
          const texte = contexte ? `${question}\n\nContexte de cette image : ${contexte}` : question;
          reponses[k] = { url, reponse: textOf(await callWithFallback(modeles, [{ text: texte }, image])) };
        } catch (e) {
          reponses[k] = { url, erreur: messageErreur(e).slice(0, 400) };
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLELE, images.length) }, () => suivant()));
    return json({ ok: true, reponses });
  } catch (e) {
    return json({ ok: false, error: messageErreur(e) }, 500);
  }
});
