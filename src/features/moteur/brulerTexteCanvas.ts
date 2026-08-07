/** Burn-in texte style TikTok + emojis Apple/iOS (PNG), preview test. */

export interface ZoneBurn {
  x: number;
  y: number;
  w: number;
  h: number;
  couleur: string;
  /** true = contour/ombre visible sur le brut ; false = fill seul. */
  ombre: boolean;
  texte: string;
  /** Nombre de lignes visuelles sur le brut (hint wrap). */
  nbLignes?: number;
  /** Distinction titre / corps (taille). */
  role?: "titre" | "corps";
}

export type SlideBurnInput = {
  position: number;
  propreUrl: string;
  zones: ZoneBurn[];
};

const APPLE_EMOJI_CDN =
  "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64";

const EMOJI_RE = /\p{Extended_Pictographic}/u;

let fontReady: Promise<void> | null = null;
const emojiCache = new Map<string, HTMLImageElement | null>();

/** Charge TikTok Sans (Google Fonts) — fallback Arial Black / Impact. */
export function assurerPoliceTikTok(): Promise<void> {
  if (fontReady) return fontReady;
  fontReady = (async () => {
    if (typeof document === "undefined") return;
    const id = "sophia-tiktok-sans";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=TikTok+Sans:wght@600;700&display=swap";
      document.head.appendChild(link);
    }
    try {
      await document.fonts.load('700 48px "TikTok Sans"');
      await document.fonts.ready;
    } catch {
      // fallback système
    }
  })();
  return fontReady;
}

function contrasteStroke(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#000000";
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "#000000" : "#FFFFFF";
}

/**
 * Ne snap que les teintes clairement blanc / rose TikTok.
 * Sinon on garde le hex Gemini (éviter #FFFFFE → ok, mais pas #E8C4A0 → blanc).
 */
function normaliserCouleur(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#FFFFFF";
  const raw = m[1]!.toUpperCase();
  const n = parseInt(raw, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;

  // Blanc / quasi-blanc / gris très clair de fill
  if (r >= 235 && g >= 235 && b >= 235) return "#FFFFFF";
  // Noir / quasi-noir
  if (r <= 35 && g <= 35 && b <= 35) return "#000000";
  // Rose / magenta TikTok (#FE2C55 et proches)
  const distRose =
    Math.abs(r - 0xfe) + Math.abs(g - 0x2c) + Math.abs(b - 0x55);
  if (distRose < 90 && r > 200 && g < 120 && b > 60 && b < 160) {
    return "#FE2C55";
  }
  // Jaune TikTok fréquent
  if (r > 230 && g > 200 && b < 80) return "#FFE600";
  // Cyan / bleu clair fréquent
  if (r < 100 && g > 180 && b > 220) return `#${raw}`;

  return `#${raw}`;
}

function emojiToUnified(emoji: string): string {
  const cps: string[] = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp == null) continue;
    if (cp === 0xfe0f) continue;
    cps.push(cp.toString(16));
  }
  return cps.join("-");
}

function segmenterGraphemes(texte: string): string[] {
  const IntlAny = Intl as typeof Intl & {
    Segmenter?: new (
      locales?: string | string[],
      options?: { granularity: "grapheme" | "word" | "sentence" },
    ) => { segment: (input: string) => Iterable<{ segment: string }> };
  };
  if (typeof IntlAny.Segmenter === "function") {
    const seg = new IntlAny.Segmenter(undefined, { granularity: "grapheme" });
    return [...seg.segment(texte)].map((s) => s.segment);
  }
  return [...texte];
}

type Run = { kind: "text"; value: string } | { kind: "emoji"; value: string };

function tokenizerRuns(texte: string): Run[] {
  const graphemes = segmenterGraphemes(texte);
  const runs: Run[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      runs.push({ kind: "text", value: buf });
      buf = "";
    }
  };
  for (const g of graphemes) {
    if (EMOJI_RE.test(g)) {
      flush();
      runs.push({ kind: "emoji", value: g });
    } else {
      buf += g;
    }
  }
  flush();
  return runs;
}

async function chargerEmojiApple(emoji: string): Promise<HTMLImageElement | null> {
  const unified = emojiToUnified(emoji);
  if (!unified) return null;
  if (emojiCache.has(unified)) return emojiCache.get(unified) ?? null;

  const urls = [
    `${APPLE_EMOJI_CDN}/${unified}.png`,
    `${APPLE_EMOJI_CDN}/${[...emoji].map((c) => c.codePointAt(0)!.toString(16)).join("-")}.png`,
  ];

  for (const url of urls) {
    try {
      const img = await chargerImage(url);
      emojiCache.set(unified, img);
      return img;
    } catch {
      // try next
    }
  }
  emojiCache.set(unified, null);
  return null;
}

async function prechargerEmojis(texte: string): Promise<void> {
  const runs = tokenizerRuns(texte);
  await Promise.all(
    runs.filter((r) => r.kind === "emoji").map((r) => chargerEmojiApple(r.value)),
  );
}

function largeurEmoji(size: number): number {
  return size * 1.05;
}

function mesurerLigne(
  ctx: CanvasRenderingContext2D,
  line: string,
  size: number,
): number {
  let w = 0;
  for (const run of tokenizerRuns(line)) {
    if (run.kind === "emoji") {
      w += largeurEmoji(size) + size * 0.06;
    } else {
      w += ctx.measureText(run.value).width;
    }
  }
  return w;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  texte: string,
  maxW: number,
  size: number,
): string[] {
  const paragraphs = texte.replace(/\r/g, "").split(/\n/);
  const lines: string[] = [];

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) {
      if (paragraphs.length > 1) lines.push("");
      continue;
    }
    const rawTokens = trimmed.split(/(\s+)/).filter((t) => t.length > 0);
    const tokens: string[] = [];
    for (const t of rawTokens) {
      if (/^\s+$/.test(t)) continue;
      const parts = segmenterGraphemes(t);
      let word = "";
      for (const g of parts) {
        if (EMOJI_RE.test(g)) {
          if (word) tokens.push(word);
          word = "";
          tokens.push(g);
        } else {
          word += g;
        }
      }
      if (word) tokens.push(word);
    }

    let cur = "";
    for (const tok of tokens) {
      const trial = cur ? `${cur} ${tok}` : tok;
      const glued = cur && EMOJI_RE.test(tok) ? `${cur} ${tok}` : trial;
      if (mesurerLigne(ctx, glued, size) <= maxW || !cur) {
        cur = glued;
      } else {
        lines.push(cur);
        cur = tok;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines.length ? lines : [texte];
}

function geometryZone(
  z: ZoneBurn,
  canvasW: number,
  canvasH: number,
): { x: number; y: number; w: number; h: number; maxW: number; maxH: number } {
  let zx = z.x;
  let zw = z.w;
  if (zw < 0.72) {
    const cible = 0.84;
    zx = Math.max(0.04, z.x + z.w / 2 - cible / 2);
    zw = Math.min(0.92, cible);
  }
  const x = zx * canvasW;
  const y = z.y * canvasH;
  const w = zw * canvasW;
  const h = Math.max(z.h * canvasH, canvasH * 0.18);
  const padX = w * 0.03;
  const padY = h * 0.04;
  return {
    x,
    y,
    w,
    h,
    maxW: Math.max(8, w - padX * 2),
    maxH: Math.max(8, h - padY * 2),
  };
}

function roleZone(z: ZoneBurn): "titre" | "corps" {
  if (z.role === "titre" || z.role === "corps") return z.role;
  const t = (z.texte ?? "").trim();
  const mots = t.split(/\s+/).filter(Boolean).length;
  const lignes = z.nbLignes ?? t.split(/\n/).filter((l) => l.trim()).length;
  // Court + peu de lignes → titre
  if (mots <= 6 && lignes <= 2) return "titre";
  return "corps";
}

/**
 * Taille candidate d'une zone (fit libre dans sa box).
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  texte: string,
  maxW: number,
  maxH: number,
  family: string,
  nbLignesHint?: number,
  tailleMax?: number,
): { size: number; lines: string[] } {
  const hiCap = Math.min(
    tailleMax ?? 92,
    Math.min(92, Math.max(22, Math.floor(maxH * 0.42))),
  );
  let lo = 14;
  let hi = hiCap;
  let best = lo;
  let bestLines = [texte];

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    ctx.font = `700 ${mid}px ${family}`;
    let lines = wrapLines(ctx, texte, maxW, mid);

    if (nbLignesHint && nbLignesHint > 1 && lines.length < nbLignesHint) {
      let virtW = maxW;
      for (let i = 0; i < 8 && lines.length < nbLignesHint; i += 1) {
        virtW *= 0.88;
        lines = wrapLines(ctx, texte, virtW, mid);
      }
    }

    const lineH = mid * 1.22;
    const totalH = lines.length * lineH;
    const maxLineW = Math.max(...lines.map((l) => mesurerLigne(ctx, l, mid)), 0);
    if (totalH <= maxH && maxLineW <= maxW * 1.02) {
      best = mid;
      bestLines = lines;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  ctx.font = `700 ${best}px ${family}`;
  return { size: best, lines: bestLines };
}

/** Wrap à une taille fixée ; réduit légèrement si ça déborde. */
function wrapATaille(
  ctx: CanvasRenderingContext2D,
  texte: string,
  maxW: number,
  maxH: number,
  family: string,
  tailleCible: number,
  nbLignesHint?: number,
): { size: number; lines: string[] } {
  let size = Math.max(12, Math.round(tailleCible));
  for (let guard = 0; guard < 24; guard += 1) {
    ctx.font = `700 ${size}px ${family}`;
    let lines = wrapLines(ctx, texte, maxW, size);
    if (nbLignesHint && nbLignesHint > 1 && lines.length < nbLignesHint) {
      let virtW = maxW;
      for (let i = 0; i < 6 && lines.length < nbLignesHint; i += 1) {
        virtW *= 0.9;
        lines = wrapLines(ctx, texte, virtW, size);
      }
    }
    const lineH = size * 1.22;
    const totalH = lines.length * lineH;
    const maxLineW = Math.max(...lines.map((l) => mesurerLigne(ctx, l, size)), 0);
    if (totalH <= maxH && maxLineW <= maxW * 1.02) {
      return { size, lines };
    }
    size -= 1;
    if (size < 12) break;
  }
  return fitFontSize(ctx, texte, maxW, maxH, family, nbLignesHint);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

/**
 * Estime une taille corps (et titre) unique pour tout le slideshow.
 * Les slides TikTok gardent en général la même taille de corps.
 */
export async function calculerTaillesSlideshow(
  slides: SlideBurnInput[],
): Promise<{ corps: number; titre: number }> {
  await assurerPoliceTikTok();
  const family = '"TikTok Sans", "Arial Black", Impact, sans-serif';
  const taillesCorps: number[] = [];
  const taillesTitre: number[] = [];

  for (const slide of slides) {
    if (!slide.zones.length) continue;
    const img = await chargerImage(slide.propreUrl);
    const cw = img.naturalWidth || img.width;
    const ch = img.naturalHeight || img.height;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    for (const z of slide.zones) {
      const texte = (z.texte ?? "").trim();
      if (!texte) continue;
      const g = geometryZone(z, cw, ch);
      // Estimation géométrique depuis le brut (h / nbLignes)
      const nb = Math.max(1, z.nbLignes ?? 4);
      const estimeGeo = Math.round(((z.h * ch) / nb) / 1.22);
      const { size } = fitFontSize(
        ctx,
        texte,
        g.maxW,
        g.maxH,
        family,
        z.nbLignes,
      );
      // Mélange fit box + hint géométrique source
      const candidate = Math.round(size * 0.55 + estimeGeo * 0.45);
      if (roleZone(z) === "titre") taillesTitre.push(candidate);
      else taillesCorps.push(candidate);
    }
  }

  let corps = Math.round(median(taillesCorps));
  if (!corps) corps = Math.round(median(taillesTitre)) || 36;
  // Borne raisonnable 9:16
  corps = Math.max(22, Math.min(56, corps));

  let titre = Math.round(median(taillesTitre));
  if (!titre) titre = Math.round(corps * 1.2);
  // Titre un peu plus grand, mais pas disproportionné
  titre = Math.max(corps, Math.min(72, titre));
  if (titre < corps * 1.08) titre = Math.round(corps * 1.18);

  return { corps, titre };
}

function dessinerLigne(
  ctx: CanvasRenderingContext2D,
  line: string,
  cx: number,
  cy: number,
  size: number,
  fill: string,
  stroke: string,
  avecContour: boolean,
): void {
  const runs = tokenizerRuns(line);
  const totalW = mesurerLigne(ctx, line, size);
  let x = cx - totalW / 2;
  const emojiH = size * 1.08;
  const strokeW = Math.max(3, size * 0.18);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  for (const run of runs) {
    if (run.kind === "emoji") {
      const unified = emojiToUnified(run.value);
      const img = emojiCache.get(unified) ?? null;
      const ew = largeurEmoji(size);
      if (img) {
        const ey = cy - size * 0.88;
        ctx.drawImage(img, x, ey, ew, emojiH);
      } else {
        ctx.fillStyle = fill;
        ctx.fillText(run.value, x, cy);
      }
      x += ew + size * 0.06;
      continue;
    }

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    if (avecContour) {
      ctx.lineWidth = strokeW;
      ctx.strokeStyle = stroke;
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = size * 0.1;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.max(1, size * 0.03);
      ctx.strokeText(run.value, x, cy);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = fill;
    ctx.fillText(run.value, x, cy);
    x += ctx.measureText(run.value).width;
  }
}

export type OptionsBurn = {
  /** Taille forcée corps (px). */
  tailleCorps?: number;
  /** Taille forcée titre (px). */
  tailleTitre?: number;
};

/**
 * Dessine le texte traduit dans les zones (fractions 0..1) sur l'image propre.
 * Emojis = PNG Apple (iOS). Contour uniquement si zone.ombre === true.
 */
export async function brulerTexteSurImage(
  propreUrl: string,
  zones: ZoneBurn[],
  options: OptionsBurn = {},
): Promise<string> {
  await assurerPoliceTikTok();
  await Promise.all(zones.map((z) => prechargerEmojis(z.texte ?? "")));

  const img = await chargerImage(propreUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible");

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const family = '"TikTok Sans", "Arial Black", Impact, sans-serif';
  for (const z of zones) {
    const texte = (z.texte ?? "").trim();
    if (!texte) continue;

    const g = geometryZone(z, canvas.width, canvas.height);
    const role = roleZone(z);
    const cible =
      role === "titre"
        ? (options.tailleTitre ?? options.tailleCorps)
        : options.tailleCorps;

    const { size, lines } = cible
      ? wrapATaille(
          ctx,
          texte,
          g.maxW,
          g.maxH,
          family,
          cible,
          z.nbLignes,
        )
      : fitFontSize(ctx, texte, g.maxW, g.maxH, family, z.nbLignes);

    const lineH = size * 1.22;
    const blockH = lines.length * lineH;
    let cy = g.y + Math.max(g.h * 0.04, (g.h - blockH) * 0.15) + size * 0.85;
    const cx = g.x + g.w / 2;
    const fill = normaliserCouleur(z.couleur || "#FFFFFF");
    const stroke = contrasteStroke(fill);
    // Contour UNIQUEMENT si détecté sur le brut
    const avecContour = z.ombre === true;

    ctx.font = `700 ${size}px ${family}`;
    for (const line of lines) {
      dessinerLigne(ctx, line, cx, cy, size, fill, stroke, avecContour);
      cy += lineH;
    }
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * Burn toutes les slides d'un slideshow avec une taille corps/titre partagée.
 */
export async function brulerSlideshow(
  slides: SlideBurnInput[],
): Promise<Map<number, string>> {
  const tailles = await calculerTaillesSlideshow(slides);
  const out = new Map<number, string>();
  for (const slide of slides) {
    const dataUrl = await brulerTexteSurImage(slide.propreUrl, slide.zones, {
      tailleCorps: tailles.corps,
      tailleTitre: tailles.titre,
    });
    out.set(slide.position, dataUrl);
  }
  return out;
}

function chargerImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`Chargement image échoué: ${url.slice(0, 80)}`));
    img.src = url;
  });
}
