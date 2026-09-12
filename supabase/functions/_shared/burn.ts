/**
 * Burn-in du texte traduit sur les slides — cœur partagé.
 *
 * Trois étages, chacun mis en cache parce qu'il ne dépend pas du compte :
 *
 *   1. l'analyse du style (LLM vision sur l'image d'origine) → une fois par
 *      slide, `burn_analyses` ;
 *   2. le rendu (Pillow, sur Vercel : Deno n'a ni Pillow ni numpy) → une fois
 *      par (slide, langue), `burn_rendus` ;
 *   3. la pose sur la slide du poster → `post_slides.burned_media_id`.
 *
 * Rien ici n'est bloquant : une slide qui n'a pas pu être brûlée garde son
 * image propre et son `texte_overlay`, et le poster la reçoit en classique.
 *
 * La file et les petits utilitaires vivent dans `burn_file.ts`, qui n'embarque
 * pas le LLM : c'est ce qui garde les trees du pipeline légers.
 */

import { type SlideABruler } from "./burn_file.ts";
import { lireStyleBurn, type BlocLu } from "./gemini.ts";
import { serviceClient } from "./supabase.ts";

export * from "./burn_file.ts";

type Supabase = ReturnType<typeof serviceClient>;

const BUCKET = "medias";
const BURN_URL_DEFAUT = "https://micabo-os.vercel.app/api/burn";

/**
 * Marque du lecteur dans `burn_analyses.modele`. Le suffixe porte le modèle qui
 * a réellement répondu : une lecture faite par un autre modèle est une AUTRE
 * lecture, pas la même en moins frais. Les lignes sans suffixe sont celles de
 * `gemini-2.5-flash` — on ne les resserre pas, on relit.
 */
const MARQUE_LECTURE = "burn-kit/read_style:";

export type RenduBurn = {
  mediaId: string;
  url: string;
  cache: boolean;
  rapport?: unknown;
};

export function nbMots(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Étage 1 — lecture du style, une fois par slide d'origine
// ---------------------------------------------------------------------------

/**
 * Blocs lus sur la slide d'origine, depuis le cache ou le LLM.
 *
 * `contenuId` nul = appel de test hors slideshow : on lit sans rien écrire.
 */
export async function blocsPourSlide(
  supabase: Supabase,
  args: {
    contenuId: string | null;
    position: number;
    brutUrl: string;
    force?: boolean;
  },
): Promise<{ blocs: BlocLu[]; cache: boolean }> {
  if (args.contenuId && !args.force) {
    const { data } = await supabase
      .from("burn_analyses")
      .select("zones, modele")
      .eq("contenu_id", args.contenuId)
      .eq("position", args.position)
      .maybeSingle();
    const blocs = data?.zones as BlocLu[] | undefined;
    const modele = (data?.modele as string | null) ?? "";
    // Deux générations de lignes sont à jeter plutôt qu'à traduire : celles
    // d'avant le kit (format zones, fractions et hex) et celles lues par
    // Gemini, dont les bbox ne tiennent pas la tolérance de l'autotest.
    const auFormatDuKit =
      Array.isArray(blocs) && blocs.length > 0 && Array.isArray(blocs[0]?.bbox);
    if (auFormatDuKit && modele.startsWith(MARQUE_LECTURE)) {
      return { blocs: blocs!, cache: true };
    }
  }

  const { blocs, modele } = await lireStyleBurn(args.brutUrl);
  if (args.contenuId && blocs.length > 0) {
    await supabase.from("burn_analyses").upsert({
      contenu_id: args.contenuId,
      position: args.position,
      zones: blocs,
      modele: `${MARQUE_LECTURE}${modele}`,
    });
  }
  return { blocs, cache: false };
}

// ---------------------------------------------------------------------------
// Étage 2 — rendu déterministe (Vercel / moteur du kit)
// ---------------------------------------------------------------------------

/**
 * Appelle le moteur de rendu et rend le JPEG.
 *
 * La capture d'origine sert de mètre étalon, l'image propre de support. Le
 * moteur enchaîne recalage, mesure, autotest dans la langue source, ajustement
 * au cadre et rendu — c'est le pipeline du kit, rien n'est décidé ici.
 */
export async function rendreImageBurn(args: {
  brutUrl: string;
  propreUrl: string;
  blocs: BlocLu[];
  traductions: Record<string, { text: string; text_short?: string }>;
}): Promise<{ bytes: Uint8Array; rapport: unknown; fiable: boolean }> {
  const secret = Deno.env.get("BURN_SECRET");
  if (!secret) throw new Error("BURN_SECRET manquant");
  const url = Deno.env.get("BURN_URL") || BURN_URL_DEFAUT;

  if (args.blocs.length === 0) throw new Error("aucun bloc lu sur la slide");

  const reponse = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-burn-secret": secret },
    body: JSON.stringify({
      shot: args.brutUrl,
      clean: args.propreUrl,
      blocks: args.blocs,
      translations: args.traductions,
    }),
  });

  const corps = await reponse.json().catch(() => null) as
    | {
      image?: string;
      erreur?: string;
      fiable?: boolean;
      selftest?: unknown;
      spec?: unknown;
      reductions?: unknown;
    }
    | null;
  if (!reponse.ok || !corps?.image) {
    // 401 = le moteur a bien répondu, mais il n'a pas reconnu le secret : soit
    // les deux côtés ne portent pas la même valeur, soit Vercel n'a pas été
    // redéployé depuis qu'elle y a été posée (l'environnement est figé au
    // build). Le dire évite de chercher du côté du rendu.
    const aide = reponse.status === 401
      ? " — BURN_SECRET différent entre l'Edge et Vercel, ou Vercel pas redéployé depuis ;" +
        " GET /api/burn répond « secret » = false tant que le lambda ne l'a pas"
      : "";
    throw new Error(
      `rendu burn ${reponse.status}: ${corps?.erreur ?? "réponse illisible"}${aide}`,
    );
  }
  return {
    bytes: base64Vers(corps.image),
    rapport: {
      selftest: corps.selftest,
      spec: corps.spec,
      reductions: corps.reductions,
    },
    fiable: corps.fiable === true,
  };
}

function base64Vers(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// Étage 3 — image brûlée d'une slide, mise en cache par langue
// ---------------------------------------------------------------------------

/**
 * Répartit le texte du deck sur les blocs lus.
 *
 * Le kit traduit bloc par bloc ; notre deck, lui, porte UN texte par slide,
 * déjà traduit et déjà garni du CTA micabo — c'est un choix produit, pas une
 * technique de burn, et il n'est pas question de le refaire à chaque langue.
 * On répartit donc au prorata des longueurs d'origine.
 */
export function repartirDeckSurBlocs(
  texte: string,
  blocs: BlocLu[],
): Record<string, { text: string; text_short?: string }> {
  const t = texte.trim();
  if (blocs.length === 0) return {};
  if (blocs.length === 1) return { [blocs[0]!.id]: { text: t } };

  const poids = blocs.map((b) => Math.max(1, nbMots(b.text)));
  const total = poids.reduce((a, b) => a + b, 0);
  const mots = t.split(/\s+/).filter(Boolean);
  const out: Record<string, { text: string; text_short?: string }> = {};
  let curseur = 0;
  blocs.forEach((bloc, i) => {
    if (i === blocs.length - 1) {
      out[bloc.id] = { text: mots.slice(curseur).join(" ") };
      return;
    }
    const n = Math.max(1, Math.round((poids[i]! / total) * mots.length));
    out[bloc.id] = { text: mots.slice(curseur, curseur + n).join(" ") };
    curseur += n;
  });
  return out;
}

export async function brulerSlide(
  supabase: Supabase,
  args: {
    contenuId: string;
    position: number;
    langue: string;
    brutUrl: string;
    propreUrl: string;
    texte: string;
    compteReferenceId?: string | null;
    force?: boolean;
  },
): Promise<RenduBurn> {
  const langue = args.langue.toLowerCase();

  if (!args.force) {
    const { data } = await supabase
      .from("burn_rendus")
      .select("media_id, url, texte, rapport")
      .eq("contenu_id", args.contenuId)
      .eq("position", args.position)
      .eq("langue", langue)
      .maybeSingle();
    // Le texte a pu être retraduit depuis : on ne resservirait pas la bonne image.
    if (data?.media_id && data.url && (data.texte ?? "") === args.texte) {
      return {
        mediaId: data.media_id as string,
        url: data.url as string,
        cache: true,
        rapport: data.rapport,
      };
    }
  }

  const { blocs } = await blocsPourSlide(supabase, {
    contenuId: args.contenuId,
    position: args.position,
    brutUrl: args.brutUrl,
  });
  const { bytes, rapport, fiable } = await rendreImageBurn({
    brutUrl: args.brutUrl,
    propreUrl: args.propreUrl,
    blocs,
    traductions: repartirDeckSurBlocs(args.texte, blocs),
  });
  // Règle non négociable du kit : on rend le texte source avec le style mesuré
  // et on le compare à la capture. Tant que ça ne passe pas, on ne publie pas
  // la traduction — la slide part en classique.
  if (!fiable) {
    throw new Error(
      "autotest du moteur en échec (position ou largeur hors tolérance) — slide laissée en classique",
    );
  }
  const chemin = `burned/${args.contenuId}/${langue}/${args.position}.jpg`;
  const { error: errUp } = await supabase.storage.from(BUCKET).upload(chemin, bytes, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "60",
  });
  if (errUp) throw errUp;
  const publique = supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
  const url = `${publique}?v=${Date.now()}`;

  // Un seul média par (slide, langue) : on réécrit la ligne existante au lieu
  // d'en empiler une par burn, le fichier étant écrasé au même chemin.
  const { data: existant } = await supabase
    .from("media_library")
    .select("id")
    .eq("storage_path", chemin)
    .maybeSingle();

  let mediaId = existant?.id as string | undefined;
  if (mediaId) {
    const { error } = await supabase
      .from("media_library")
      .update({ url, langue, texte_restant: true })
      .eq("id", mediaId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("media_library")
      .insert({
        storage_path: chemin,
        url,
        source: "nettoye_reference",
        langue,
        contenu_id: args.contenuId,
        compte_reference_id: args.compteReferenceId ?? null,
        // Le texte incrusté est voulu : ce média ne doit jamais repasser au
        // nettoyage automatique ni être proposé comme visuel vierge.
        texte_restant: true,
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("média brûlé non créé");
    mediaId = data.id as string;
  }

  const { error: errC } = await supabase.from("burn_rendus").upsert({
    contenu_id: args.contenuId,
    position: args.position,
    langue,
    media_id: mediaId,
    url,
    texte: args.texte,
    rapport,
  });
  if (errC) throw errC;

  return { mediaId: mediaId!, url, cache: false, rapport };
}

// ---------------------------------------------------------------------------
// File des slides à brûler
// ---------------------------------------------------------------------------

/** Brûle une slide et la pose sur le post. Ne jette pas : trace et repart. */
export async function brulerSlideAssignee(
  supabase: Supabase,
  slide: SlideABruler,
): Promise<{ ok: boolean; cache: boolean; erreur?: string }> {
  try {
    const rendu = await brulerSlide(supabase, {
      contenuId: slide.contenuId,
      position: slide.position,
      langue: slide.langue,
      brutUrl: slide.brutUrl,
      propreUrl: slide.propreUrl,
      texte: slide.texte,
      compteReferenceId: slide.compteReferenceId,
    });
    const { error } = await supabase
      .from("post_slides")
      .update({
        burned_media_id: rendu.mediaId,
        burned_at: new Date().toISOString(),
        burn_erreur: null,
      })
      .eq("id", slide.slideId);
    if (error) throw error;
    return { ok: true, cache: rendu.cache };
  } catch (e) {
    const erreur = e instanceof Error ? e.message : String(e);
    await supabase
      .from("post_slides")
      .update({ burn_erreur: erreur.slice(0, 500) })
      .eq("id", slide.slideId);
    return { ok: false, cache: false, erreur };
  }
}
