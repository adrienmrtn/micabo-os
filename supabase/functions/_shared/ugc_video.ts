/**
 * Atelier AI UGC (0308, 06/10/2026) — règles PURES, sans réseau.
 *
 * Réexporté par `src/features/ugc/ugcVideo.ts` pour que Vitest les lise et que
 * l'écran compte comme la fonction (`ugc-video`) : moteurs Kling et leurs prix,
 * datation de la planche, lecture de la coupe proposée, gardes de durée, et les
 * deux prompts Nano Banana (décor du persona ou décor d'origine).
 */

export type MoteurKling =
  | "kling-v2.6-pro"
  | "kling-v2.6-standard"
  | "kling-v3-pro"
  | "kling-v3-standard";

/** Endpoints Fal et prix par seconde de vidéo produite, lus sur l'API Fal le 06/10/2026. */
export const MOTEURS_KLING: Record<MoteurKling, { endpoint: string; prixParSeconde: number }> = {
  "kling-v2.6-pro": { endpoint: "fal-ai/kling-video/v2.6/pro/motion-control", prixParSeconde: 0.112 },
  "kling-v2.6-standard": { endpoint: "fal-ai/kling-video/v2.6/standard/motion-control", prixParSeconde: 0.07 },
  "kling-v3-pro": { endpoint: "fal-ai/kling-video/v3/pro/motion-control", prixParSeconde: 0.168 },
  "kling-v3-standard": { endpoint: "fal-ai/kling-video/v3/standard/motion-control", prixParSeconde: 0.126 },
};

export const MOTEUR_DEFAUT: MoteurKling = "kling-v2.6-pro";

export function estMoteurKling(v: unknown): v is MoteurKling {
  return typeof v === "string" && v in MOTEURS_KLING;
}

/** Nano Banana Pro edit, une image (prix Fal du 06/10/2026). */
export const PRIX_IMAGE_PERSONA = 0.15;

/** Coût d'un rendu en dollars : l'image du persona plus Kling à la seconde. */
export function coutRendu(moteur: MoteurKling, dureeSec: number | null): number {
  const s = dureeSec != null && dureeSec > 0 ? dureeSec : 0;
  return Math.round((PRIX_IMAGE_PERSONA + MOTEURS_KLING[moteur].prixParSeconde * s) * 1000) / 1000;
}

/**
 * Bornes du segment réaction. Sous 3 s, Kling n'a pas de mouvement à lire
 * (garde de l'ancien module, retiré le 14/09). Au-dessus de 30 s, motion
 * control refuse en `character_orientation = video`.
 */
export const REACTION_MIN_S = 3;
export const REACTION_MAX_S = 30;

/** Kling rend parfois une vidéo tronquée : sous 85 % de la réaction, c'est un échec. */
export const RATIO_DUREE_MIN = 0.85;

export function dureeReactionValide(dureeSec: number): boolean {
  return Number.isFinite(dureeSec) && dureeSec >= REACTION_MIN_S && dureeSec <= REACTION_MAX_S;
}

export function renduAssezLong(dureeRenduSec: number | null, dureeReactionSec: number): boolean {
  if (dureeRenduSec == null) return false;
  return dureeRenduSec >= dureeReactionSec * RATIO_DUREE_MIN;
}

/**
 * Pas d'extraction (`frame_index` de `extract-nth-frame`) pour une image
 * toutes les ~0,5 s, plafonné à ~48 images sur une longue vidéo.
 */
export function pasPlanche(dureeSec: number, fps: number): number {
  const f = fps > 0 ? fps : 30;
  const intervalle = Math.max(0.5, dureeSec / 48);
  return Math.max(1, Math.round(f * intervalle));
}

/**
 * Instant de chaque image de la planche. Fal répartit les images uniformément
 * de 0 à la fin (mesuré le 06/10 sur une vidéo rouge / vert / bleu d'1 s
 * chacune : 8 images, 3 rouges, 2 vertes, 3 bleues).
 */
export function instantsPlanche(n: number, dureeSec: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  return Array.from({ length: n }, (_, k) => Math.round(((k * dureeSec) / (n - 1)) * 100) / 100);
}

export interface Coupe {
  debut_s: number;
  fin_s: number;
  /** Début de la démo d'origine, si le modèle l'a vu (sert à l'OCR du texte démo). */
  demo_debut_s: number | null;
  raison: string;
}

/**
 * Lit la coupe rendue par le modèle de vision : un objet JSON, éventuellement
 * entouré de texte. Bornée à la vidéo, refusée si le segment est trop court.
 */
export function lireCoupe(texte: string, dureeSec: number): Coupe | null {
  const m = texte.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  const nombre = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const borne = (n: number) => Math.min(Math.max(n, 0), dureeSec);
  const debut = nombre(o.debut_s);
  const fin = nombre(o.fin_s);
  if (debut == null || fin == null) return null;
  const d = borne(debut);
  const f = borne(fin);
  if (f - d < 1) return null;
  const demo = nombre(o.demo_debut_s);
  return {
    debut_s: d,
    fin_s: f,
    demo_debut_s: demo == null ? null : borne(demo),
    raison: typeof o.raison === "string" ? o.raison.slice(0, 300) : "",
  };
}

/** Prompt de la coupe : les images arrivent dans l'ordre, chacune datée. */
export function promptCoupe(instants: number[], dureeSec: number): string {
  const liste = instants.map((t, k) => `image ${k + 1} : ${t.toFixed(2)} s`).join("\n");
  return `These images are frames of ONE vertical TikTok video (${dureeSec.toFixed(1)} s), in order:
${liste}

The video has two parts:
1. a REACTION: a real person filmed by a phone camera (face, upper body, a room), usually with a caption on top,
2. then an APP DEMO: a screen recording of a phone app (interface, scrolling, buttons), sometimes with the person small in a corner.

Find the reaction segment: the first and last instants where the person is filmed by the camera and fills the frame, before the app demo starts. Ignore a very first black or transition frame.
If no person is ever filmed (screen recording only), answer null for debut_s and fin_s and say so in raison.

Answer with JSON only:
{"debut_s": <number>, "fin_s": <number>, "demo_debut_s": <number or null>, "raison": "<one short sentence>"}`;
}

/** Le persona dans SA chambre : de la frame source on ne garde que la pose. */
export const PROMPT_PERSONA_DECOR_PERSONA = `Figure 1 is a frame from a TikTok video. Use it ONLY for the pose, the framing, the camera angle and distance, the facial expression, the gaze and the hand gestures.
Figures 2 and after show ONE person, the persona, in the persona's own room.

Make a photo of the persona from Figures 2+, in the persona's room from Figures 2+, reproducing exactly the pose, framing, camera angle, distance, facial expression, gaze and gestures of Figure 1.
- Face, hair, skin tone, build and clothes come from Figures 2+.
- Background and lighting come from the room of Figures 2+, seen from the angle that matches Figure 1.
- Objects in the foreground of Figure 1 that the person holds, touches or could reach (tablet, laptop, phone, notebook, pen, cup) stay, at the same place, size and angle: later in the video the hands use them (closing a tablet, picking up a phone).
- Take NOTHING else from Figure 1: not the person, not the room, not the clothes, no other object.
- No text, no captions, no stickers, no emoji, no watermark, no logo.
- ONE single photo, same orientation as Figure 1: never a grid, a collage, a triptych or several views side by side.
- Vertical amateur phone front-camera photo, natural skin texture with pores, same image quality as Figures 2+.`;

/** Le persona à la place de la personne, dans le décor d'origine. */
export const PROMPT_PERSONA_DECOR_SOURCE = `Figure 1 is the base photo (scene + pose). Figures 2 and after are reference photos of ONE same person, the persona.

Transfer the FULL identity of the persona onto Figure 1. This is NOT a head swap:
- face, facial features, hairstyle, hair color, eye color,
- skin tone and texture on ALL visible skin (face, neck, arms, hands), with no mismatch between head and body,
- body build consistent with the persona references.

KEEP from Figure 1 exactly: body pose, hand positions, gesture, facial expression, gaze, clothing, framing, camera angle, background, lighting, color grade and phone-photo grain.
Remove any text, caption, sticker or watermark: the result has no text at all.
ONE single photo, same orientation as Figure 1: never a grid, a collage, a triptych or several views side by side.
Photorealistic, casual amateur phone-photo look.`;

export function promptPersona(decor: "persona" | "source"): string {
  return decor === "source" ? PROMPT_PERSONA_DECOR_SOURCE : PROMPT_PERSONA_DECOR_PERSONA;
}

/** Les formats que Nano Banana Pro accepte, hors « auto ». */
export const RATIOS_NANO_BANANA = ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"] as const;

function valeurRatio(r: string): number {
  const [l, h] = r.split(":").map(Number);
  return l! / h!;
}

/**
 * Le format Nano Banana le plus proche de l'image de départ. « auto » a rendu
 * un triptyque paysage (trois vues côte à côte) pour Inès le 06/10, sur une
 * image de départ en 9:16 : le format se donne, il ne se laisse pas choisir.
 */
export function ratioNanoBanana(largeur: number, hauteur: number): string {
  if (!(largeur > 0) || !(hauteur > 0)) return "9:16";
  const cible = Math.log(largeur / hauteur);
  let meilleur: string = RATIOS_NANO_BANANA[0];
  for (const r of RATIOS_NANO_BANANA) {
    if (Math.abs(Math.log(valeurRatio(r)) - cible) < Math.abs(Math.log(valeurRatio(meilleur)) - cible)) meilleur = r;
  }
  return meilleur;
}

/** L'image rendue a-t-elle la forme demandée (à 6 % près) ? */
export function formeConforme(largeur: number, hauteur: number, ratio: string): boolean {
  if (!(largeur > 0) || !(hauteur > 0)) return false;
  return Math.abs(Math.log(largeur / hauteur) - Math.log(valeurRatio(ratio))) < 0.06;
}

/** Prompt Kling : court, le mouvement vient de la vidéo de référence. */
export const PROMPT_KLING =
  "The same person as in the image performs the same natural, spontaneous reaction as in the reference video. Amateur vertical phone video filmed with the front camera, realistic skin, same room as in the image, no text on screen.";

export interface SegmentTexte {
  segment: "reaction" | "demo";
  texte: string;
}

/** Textes saisis par l'admin : deux segments au plus, texte nettoyé, vides gardés. */
export function normaliserTextes(brut: unknown): SegmentTexte[] {
  if (!Array.isArray(brut)) return [];
  const sortie: SegmentTexte[] = [];
  for (const e of brut) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const segment = o.segment === "demo" ? "demo" : o.segment === "reaction" ? "reaction" : null;
    if (!segment || sortie.some((s) => s.segment === segment)) continue;
    const texte = typeof o.texte === "string" ? o.texte.replace(/\r\n/g, "\n").trim() : "";
    sortie.push({ segment, texte });
  }
  return sortie.sort((a, b) => (a.segment === b.segment ? 0 : a.segment === "reaction" ? -1 : 1));
}

/**
 * Le début de la démo tel que l'écran l'envoie : `null`, absent ou vide veut
 * dire « pas de démo ». `Number(null)` vaut 0 : lu naïvement, un modèle sans
 * démo (@studyywithsachii, 06/10) recevait une démo à 0 s, et l'OCR de la
 * « démo » relisait la légende de la réaction.
 */
export function lireDebutDemo(brut: unknown): number | null {
  if (brut === null || brut === undefined || brut === "") return null;
  const n = Number(brut);
  return Number.isFinite(n) ? n : null;
}

/** Identifiant de la vidéo dans un lien TikTok long (`/video/<id>`), sinon null. */
export function idVideoTiktok(url: string): string | null {
  const m = url.match(/\/video\/(\d{8,})/);
  return m ? m[1]! : null;
}

/* ─── Texte à coller, par langue ─────────────────────────────────────────── */

/** Les langues du réseau, plus l'anglais. */
export const LANGUES_UGC = ["fr", "de", "tr", "es", "en"] as const;
export type LangueUgc = (typeof LANGUES_UGC)[number];

const NOMS_LANGUES: Record<LangueUgc, string> = {
  fr: "français",
  de: "allemand",
  tr: "turc",
  es: "espagnol",
  en: "anglais",
};

/** La marque avec son mot de catégorie, comme dans les decks (0267, 0278). */
export const FORMES_MARQUE_UGC: Record<LangueUgc, string> = {
  fr: "« l'appli micabo »",
  de: "« die micabo-App » (le nom d'abord, l'article suit la phrase : « mit der micabo-App »)",
  tr: "« micabo uygulaması », le suffixe de cas sur uygulaması (« micabo uygulamasını kullan »)",
  es: "« la app micabo »",
  en: "« the micabo app »",
};

/**
 * Prompt d'adaptation du texte incrusté d'une vidéo réaction pour une langue.
 * Mêmes règles que les decks : une appli ou une méthode nommée devient micabo
 * (0287), repères scolaires localisés (0297), pas de tiret long (0268).
 */
/** Lignes non vides d'un texte : la forme que le créateur reproduit dans TikTok. */
export function lignesTexte(texte: string): number {
  return texte.split("\n").filter((l) => l.trim()).length;
}

/**
 * Une traduction garde le nombre de lignes de l'original, à une près. Le
 * prompt le demande, et le 06/10 l'allemand est quand même revenu sur une
 * seule ligne pour six (le turc sur trois) : comme la numérotation du
 * placement (0292), la forme se tient dans le code, pas dans le prompt.
 */
export function formeTraductionTenue(original: string, traduit: string): boolean {
  const n = lignesTexte(original);
  if (n < 2) return true;
  return Math.abs(lignesTexte(traduit) - n) <= 1;
}

export function promptTraductionUgc(textes: SegmentTexte[], langue: LangueUgc): string {
  const bloc = textes
    .map((s) => `<${s.segment} lignes="${lignesTexte(s.texte)}">\n${s.texte}\n</${s.segment}>`)
    .join("\n");
  return `Tu adaptes le texte incrusté d'une vidéo TikTok (une réaction filmée, suivie d'une démo d'appli d'étude) pour un compte TikTok d'étudiant qui écrit en ${NOMS_LANGUES[langue]}. Le créateur collera ce texte lui-même dans TikTok, au même endroit que sur la vidéo d'origine.

Règles :
1. Écris en ${NOMS_LANGUES[langue]} naturel, comme un élève ou un étudiant de ce pays l'écrirait sur TikTok : mêmes codes (POV, abréviations courantes), longueur proche.
1 bis. Chaque segment garde son nombre de lignes (attribut lignes), à une ligne près : le texte est posé sur la vidéo en bloc, coupé aux mêmes endroits du sens. Dans le JSON, un retour à la ligne s'écrit \\n.
2. Garde le sens, le ton et la chute. N'ajoute rien, ne commente rien.
3. Toute appli, méthode ou outil d'étude nommé devient micabo, écrit ${FORMES_MARQUE_UGC[langue]}. micabo toujours en minuscules, une seule fois dans tout le texte. Jamais « site » ni « plateforme ».
4. Examens, classes, notes, personnes ou sites propres au pays d'origine : l'équivalent local s'il existe vraiment, sinon une formule générique. Les notes sont converties au barème local.
5. Pas de tiret long, pas de guillemets autour du texte, pas d'émoji ajouté.
6. Si le texte est déjà en ${NOMS_LANGUES[langue]}, ne change que ce qu'imposent les règles 3 et 4, et corrige les fautes d'orthographe évidentes.
7. Un segment vide reste vide.

Texte d'origine, par segment :
${bloc}

Réponds en JSON seulement : {"reaction": "...", "demo": "..."}`;
}

/** Lit la réponse du modèle : un objet JSON, éventuellement entouré de texte. */
export function lireTraductionUgc(sortie: string, attendus: SegmentTexte[]): SegmentTexte[] | null {
  const m = sortie.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  const rendu: SegmentTexte[] = [];
  for (const s of attendus) {
    const v = o[s.segment];
    if (typeof v !== "string") return null;
    // Un segment plein qui revient vide est une réponse ratée, pas une traduction.
    if (s.texte.trim() && !v.trim()) return null;
    if (!formeTraductionTenue(s.texte, v.replace(/\r\n/g, "\n"))) return null;
    rendu.push({ segment: s.segment, texte: v.replace(/\r\n/g, "\n").trim() });
  }
  return rendu;
}
