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
import { analyserTexteIncrusteBrut, type ZoneTexteIncruste } from "./gemini.ts";
import { serviceClient } from "./supabase.ts";

export * from "./burn_file.ts";

type Supabase = ReturnType<typeof serviceClient>;

const BUCKET = "medias";
const BURN_URL_DEFAUT = "https://micabo-os.vercel.app/api/burn";

export type ZoneBurn = ZoneTexteIncruste & { texteSource?: string };

export type RenduBurn = {
  mediaId: string;
  url: string;
  cache: boolean;
  rapport?: unknown;
  zones?: ZoneBurn[];
};

export function nbMots(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Étage 1 — analyse du style, une fois par slide d'origine
// ---------------------------------------------------------------------------

/**
 * Zones de texte de la slide d'origine, depuis le cache ou le LLM.
 *
 * `contenuId` nul = appel de test hors slideshow : on analyse sans rien écrire.
 */
export async function zonesPourSlide(
  supabase: Supabase,
  args: {
    contenuId: string | null;
    position: number;
    brutUrl: string;
    force?: boolean;
  },
): Promise<{ zones: ZoneTexteIncruste[]; cache: boolean }> {
  if (args.contenuId && !args.force) {
    const { data } = await supabase
      .from("burn_analyses")
      .select("zones")
      .eq("contenu_id", args.contenuId)
      .eq("position", args.position)
      .maybeSingle();
    const zones = data?.zones as ZoneTexteIncruste[] | undefined;
    if (Array.isArray(zones) && zones.length > 0) return { zones, cache: true };
  }

  const zones = await analyserTexteIncrusteBrut(args.brutUrl);
  if (args.contenuId && zones.length > 0) {
    await supabase.from("burn_analyses").upsert({
      contenu_id: args.contenuId,
      position: args.position,
      zones,
      modele: "fal-openrouter-vision",
    });
  }
  return { zones, cache: false };
}

/**
 * Zone de repli quand le LLM ne voit aucun texte : bandeau central, blanc.
 * Mieux vaut une slide brûlée au centre qu'une slide sans texte du tout.
 */
export function zoneParDefaut(texte: string): ZoneTexteIncruste {
  return {
    x: 0.08,
    y: 0.38,
    w: 0.84,
    h: 0.32,
    texte,
    couleur: "#FFFFFF",
    ombre: false,
    nbLignes: Math.max(3, nbMots(texte) > 20 ? 6 : 4),
    role: "corps",
  };
}

/** Zones prêtes à brûler : fusion des faux splits + répartition du texte. */
export function preparerZonesBurn(
  zones: ZoneTexteIncruste[],
  texteTraduit: string,
): ZoneBurn[] {
  const base = zones.length > 0 ? zones : [zoneParDefaut(texteTraduit)];
  const normalisees = normaliserZonesTitreCorps(base);
  const parts = repartirTexteSurZones(texteTraduit, normalisees);
  return normalisees.map((z, i) => ({
    ...z,
    texte: parts[i] ?? "",
    texteSource: z.texte,
  }));
}

// ---------------------------------------------------------------------------
// Étage 2 — rendu déterministe (Vercel / Pillow)
// ---------------------------------------------------------------------------

/**
 * Appelle le moteur de rendu et rend le JPEG.
 *
 * L'image d'origine sert de mètre étalon (taille, interlettrage, contour,
 * interligne sont MESURÉS dessus), l'image propre sert de support.
 */
export async function rendreImageBurn(args: {
  brutUrl: string;
  propreUrl: string;
  zones: ZoneBurn[];
}): Promise<{ bytes: Uint8Array; rapport: unknown; fiable: boolean }> {
  const secret = Deno.env.get("BURN_SECRET");
  if (!secret) throw new Error("BURN_SECRET manquant");
  const url = Deno.env.get("BURN_URL") || BURN_URL_DEFAUT;

  const zones = args.zones.filter((z) => (z.texte ?? "").trim().length > 0);
  if (zones.length === 0) throw new Error("aucun texte à incruster");

  const reponse = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-burn-secret": secret },
    body: JSON.stringify({
      brut: args.brutUrl,
      propre: args.propreUrl,
      zones: zones.map((z) => ({
        x: z.x,
        y: z.y,
        w: z.w,
        h: z.h,
        texte: z.texteSource ?? z.texte,
        couleur: z.couleur,
        ombre: z.ombre,
        nbLignes: z.nbLignes,
        role: z.role,
      })),
      textes: zones.map((z) => z.texte),
    }),
  });

  const corps = await reponse.json().catch(() => null) as
    | { image?: string; rapport?: unknown; erreur?: string; fiable?: boolean }
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
    rapport: corps.rapport,
    fiable: corps.fiable !== false,
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

  const { zones: brutes } = await zonesPourSlide(supabase, {
    contenuId: args.contenuId,
    position: args.position,
    brutUrl: args.brutUrl,
  });
  const zones = preparerZonesBurn(brutes, args.texte);
  const { bytes, rapport, fiable } = await rendreImageBurn({
    brutUrl: args.brutUrl,
    propreUrl: args.propreUrl,
    zones,
  });
  // Le moteur se contrôle en redessinant le texte d'origine : quand il n'y
  // arrive pas, la slide part en classique. Une image approximative sur le
  // compte d'un créateur coûte plus cher qu'une slide non brûlée.
  if (!fiable) {
    throw new Error(
      "rendu non conforme au contrôle (position ou largeur hors tolérance) — slide laissée en classique",
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

  return { mediaId: mediaId!, url, cache: false, rapport, zones };
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

// ---------------------------------------------------------------------------
// Découpage titre / corps (partagé avec le test admin)
// ---------------------------------------------------------------------------

/**
 * Fusionne les faux splits du LLM : plusieurs zones « corps » collées → une
 * seule. Garde titre + corps distincts s'ils sont clairement séparés.
 */
export function normaliserZonesTitreCorps(
  zones: ZoneTexteIncruste[],
): ZoneTexteIncruste[] {
  if (zones.length <= 1) return zones;

  // Recalcule les rôles depuis le texte SOURCE (plus fiable que le flag seul).
  const withRole = zones.map((z) => {
    const mots = nbMots(z.texte);
    const lignes = Math.max(
      1,
      z.nbLignes || z.texte.split(/\n/).filter((l) => l.trim()).length,
    );
    let role: "titre" | "corps" = z.role;
    if (mots <= 7 && lignes <= 2) role = "titre";
    else if (mots >= 10 || lignes >= 3) role = "corps";
    return { ...z, role };
  });

  const titres = withRole.filter((z) => z.role === "titre");
  const corps = withRole.filter((z) => z.role === "corps");

  // Cas typique : 1 titre + N corps → fusionne les corps
  if (titres.length === 1 && corps.length >= 1) {
    const c0 = corps[0]!;
    let x = c0.x;
    let y = c0.y;
    let x2 = c0.x + c0.w;
    let y2 = c0.y + c0.h;
    const textes: string[] = [];
    let nbLignes = 0;
    let ombre = c0.ombre;
    for (const c of corps) {
      x = Math.min(x, c.x);
      y = Math.min(y, c.y);
      x2 = Math.max(x2, c.x + c.w);
      y2 = Math.max(y2, c.y + c.h);
      textes.push(c.texte.trim());
      nbLignes += Math.max(1, c.nbLignes);
      ombre = ombre || c.ombre;
    }
    const mergeCorps: ZoneTexteIncruste = {
      ...c0,
      x,
      y,
      w: Math.min(0.95, x2 - x),
      h: Math.min(0.7, y2 - y),
      texte: textes.join("\n"),
      nbLignes: Math.max(nbLignes, textes.length),
      ombre,
      role: "corps",
    };
    return [titres[0]!, mergeCorps].sort((a, b) => a.y - b.y || a.x - b.x);
  }

  // Que des corps / que des titres mal taggés → une seule zone englobante
  if (titres.length === 0 || corps.length === 0) {
    const z0 = withRole[0]!;
    let x = z0.x;
    let y = z0.y;
    let x2 = z0.x + z0.w;
    let y2 = z0.y + z0.h;
    const textes: string[] = [];
    let nbLignes = 0;
    let ombre = false;
    for (const z of withRole) {
      x = Math.min(x, z.x);
      y = Math.min(y, z.y);
      x2 = Math.max(x2, z.x + z.w);
      y2 = Math.max(y2, z.y + z.h);
      textes.push(z.texte.trim());
      nbLignes += Math.max(1, z.nbLignes);
      ombre = ombre || z.ombre;
    }
    const totalMots = nbMots(textes.join(" "));
    return [{
      ...z0,
      x,
      y,
      w: Math.min(0.95, x2 - x),
      h: Math.min(0.7, y2 - y),
      texte: textes.join("\n"),
      nbLignes: Math.max(nbLignes, 3),
      ombre,
      role: totalMots <= 7 ? "titre" : "corps",
    }];
  }

  return withRole;
}

/**
 * Répartit le texte traduit sur les zones (titre/corps) en respectant les
 * proportions du texte SOURCE, pas un split newline naïf.
 */
export function repartirTexteSurZones(
  texte: string,
  zones: ZoneTexteIncruste[],
): string[] {
  const t = texte.trim();
  if (zones.length === 0) return [];
  if (zones.length === 1) return [t];

  const lignes = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  // Titre + corps : cas le plus fréquent
  if (
    zones.length === 2 &&
    zones.some((z) => z.role === "titre") &&
    zones.some((z) => z.role === "corps")
  ) {
    const iTitre = zones.findIndex((z) => z.role === "titre");
    const iCorps = zones.findIndex((z) => z.role === "corps");
    const srcTitre = zones[iTitre]!.texte;
    const motsTitreSrc = Math.max(1, nbMots(srcTitre));

    let titre = "";
    let corps = "";

    if (lignes.length >= 2) {
      // 1ère ligne courte → titre ; sinon proportion mots source
      const l0 = lignes[0]!;
      if (nbMots(l0) <= Math.max(8, motsTitreSrc + 2)) {
        titre = l0;
        corps = lignes.slice(1).join("\n");
      } else {
        const words = t.split(/\s+/).filter(Boolean);
        const n = Math.min(words.length - 1, Math.max(1, motsTitreSrc));
        titre = words.slice(0, n).join(" ");
        corps = words.slice(n).join(" ");
      }
    } else {
      const words = t.split(/\s+/).filter(Boolean);
      const n = Math.min(words.length - 1, Math.max(1, Math.round(motsTitreSrc * 1.1)));
      if (words.length <= 3) {
        // Trop court : tout en titre, sauf si la zone corps est plus grande.
        if ((zones[iCorps]!.h) >= (zones[iTitre]!.h)) {
          titre = "";
          corps = t;
        } else {
          titre = t;
          corps = "";
        }
      } else {
        titre = words.slice(0, n).join(" ");
        corps = words.slice(n).join(" ");
      }
    }

    const out = ["", ""];
    out[iTitre] = titre;
    out[iCorps] = corps || (titre ? "" : t);
    // Si corps vide et titre plein alors qu'on attendait les deux → bascule
    if (!out[iCorps] && out[iTitre] && nbMots(out[iTitre]!) > 10) {
      const words = out[iTitre]!.split(/\s+/);
      const n = Math.min(words.length - 1, Math.max(1, motsTitreSrc));
      out[iTitre] = words.slice(0, n).join(" ");
      out[iCorps] = words.slice(n).join(" ");
    }
    return out;
  }

  // N zones : split proportionnel aux longueurs source
  const poids = zones.map((z) => Math.max(1, nbMots(z.texte)));
  const total = poids.reduce((a, b) => a + b, 0);
  const words = t.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cursor = 0;
  for (let i = 0; i < zones.length; i += 1) {
    if (i === zones.length - 1) {
      out.push(words.slice(cursor).join(" "));
      break;
    }
    const n = Math.max(1, Math.round((poids[i]! / total) * words.length));
    out.push(words.slice(cursor, cursor + n).join(" "));
    cursor += n;
  }
  return out;
}
