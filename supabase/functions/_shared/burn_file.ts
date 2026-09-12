/**
 * Burn — ce que les fonctions du pipeline ont besoin de savoir, sans le LLM.
 *
 * Séparé de `burn.ts` exprès : `upscale-assignes` et `format_media.ts` ne font
 * qu'enfiler ou invalider du burn. Leur faire traîner `gemini.ts` (52 Ko de
 * prompts) les enverrait au chargeur `_deploy` pour rien.
 */

import { serviceClient } from "./supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

/**
 * Le moteur de rendu vit sur Vercel et se ferme sur un secret partagé. Tant
 * qu'il n'est pas posé des deux côtés, le burn ne tourne pas — et surtout, il
 * ne marque pas les slides en échec toutes les quinze minutes.
 */
export function burnConfigure(): boolean {
  return Boolean(Deno.env.get("BURN_SECRET"));
}

/** Le burn devient faux dès que l'image propre change (reformat, renettoyage). */
export async function invaliderBurn(
  supabase: Supabase,
  contenuId: string,
  positions?: number[],
): Promise<void> {
  let requete = supabase.from("burn_rendus").delete().eq("contenu_id", contenuId);
  if (positions?.length) requete = requete.in("position", positions);
  await requete;
}

// ---------------------------------------------------------------------------
// File des slides à brûler
// ---------------------------------------------------------------------------

export type SlideABruler = {
  slideId: string;
  postId: string;
  position: number;
  contenuId: string;
  langue: string;
  brutUrl: string;
  propreUrl: string;
  texte: string;
  compteReferenceId: string | null;
};

/**
 * Slides du jour à brûler : comptes marqués `burned`, image propre déjà
 * upscalée (le burn vient APRÈS, sinon on brûlerait un texte qui serait
 * ensuite ré-échantillonné), texte traduit présent.
 */
export async function listerSlidesABruler(
  supabase: Supabase,
  jour: string,
  limite = 200,
): Promise<{ slides: SlideABruler[]; enAttente: number }> {
  if (!burnConfigure()) return { slides: [], enAttente: 0 };

  const { data: comptes, error: errC } = await supabase
    .from("comptes")
    .select("id, langue, compte_reference_id")
    .eq("burned", true)
    .eq("is_active", true);
  if (errC) throw errC;
  if (!comptes?.length) return { slides: [], enAttente: 0 };

  const parCompte = new Map(
    comptes.map((c) => [
      c.id as string,
      {
        langue: String(c.langue ?? "").toLowerCase(),
        reference: (c.compte_reference_id as string | null) ?? null,
      },
    ]),
  );

  const { data: posts, error: errP } = await supabase
    .from("posts")
    .select("id, compte_id")
    .eq("date_publication_prevue", jour)
    .eq("est_test", false)
    .in("compte_id", [...parCompte.keys()]);
  if (errP) throw errP;
  if (!posts?.length) return { slides: [], enAttente: 0 };

  const postIds = posts.map((p) => p.id as string);
  const { data: passages } = await supabase
    .from("passages")
    .select("post_id, contenu_id")
    .in("post_id", postIds);
  const contenuParPost = new Map(
    (passages ?? []).map((p) => [p.post_id as string, p.contenu_id as string]),
  );

  const { data: slides, error: errS } = await supabase
    .from("post_slides")
    .select(
      "id, post_id, position, texte_overlay, reference_url, burned_media_id, media_library(url, upscale_le)",
    )
    .in("post_id", postIds)
    .is("burned_media_id", null)
    .not("media_id", "is", null);
  if (errS) throw errS;

  const comptesParPost = new Map(
    posts.map((p) => [p.id as string, p.compte_id as string]),
  );
  const out: SlideABruler[] = [];
  let enAttente = 0;

  for (const s of slides ?? []) {
    const postId = s.post_id as string;
    const compteId = comptesParPost.get(postId);
    const compte = compteId ? parCompte.get(compteId) : undefined;
    const contenuId = contenuParPost.get(postId);
    // deno-lint-ignore no-explicit-any
    const media = (s as any).media_library as
      | { url?: string | null; upscale_le?: string | null }
      | null;
    const texte = String(s.texte_overlay ?? "").trim();
    const brutUrl = (s.reference_url as string | null) ?? null;

    if (!compte?.langue || !contenuId || !texte || !brutUrl || !media?.url) continue;
    if (!media.upscale_le) {
      // L'upscale passera, le filet nous rappellera : ce n'est pas une erreur.
      enAttente += 1;
      continue;
    }
    out.push({
      slideId: s.id as string,
      postId,
      position: Number(s.position),
      contenuId,
      langue: compte.langue,
      brutUrl,
      propreUrl: media.url,
      texte,
      compteReferenceId: compte.reference,
    });
    if (out.length >= limite) break;
  }
  return { slides: out, enAttente };
}

/** Kick du drain `bruler-assignes` (fire-and-forget, comme les autres drains). */
export function kickBrulerAssignes(
  request: Request,
  body: Record<string, unknown> = {},
): void {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) return;
  const secret = Deno.env.get("CRON_SECRET");
  const auth = request.headers.get("Authorization");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) headers["x-cron-secret"] = secret;
  else if (auth) headers.Authorization = auth;

  const p = fetch(`${url}/functions/v1/bruler-assignes`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }).then(() => null).catch(() => null);

  const edge = (globalThis as {
    EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (edge?.waitUntil) edge.waitUntil(p);
}
