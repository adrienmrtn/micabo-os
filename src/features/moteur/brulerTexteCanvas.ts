/** Burn-in texte style TikTok Classic + emojis Apple/iOS (PNG), preview test. */

export interface ZoneBurn {
  x: number;
  y: number;
  w: number;
  h: number;
  couleur: string;
  ombre: boolean;
  texte: string;
  /** Nombre de lignes visuelles sur le brut (hint wrap). */
  nbLignes?: number;
}

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

/** Normalise teintes fréquentes TikTok (blanc / rose). */
function normaliserCouleur(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Quasi-blanc → blanc pur
  if (r > 220 && g > 220 && b > 220) return "#FFFFFF";
  // Rose / magenta TikTok
  if (r > 180 && g < 140 && b > 100) return "#FE2C55";
  return `#${m[1]!.toUpperCase()}`;
}

function emojiToUnified(emoji: string): string {
  const cps: string[] = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp == null) continue;
    if (cp === 0xfe0f) continue; // variation selector
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
    // parfois le VS16 est requis dans le path
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

/**
 * Wrap mot-à-mot. Les emojis restent collés au mot précédent quand possible
 * (ex. "va marcher 🪻" sur une ligne).
 */
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
    // Tokens : mots + emojis isolés
    const rawTokens = trimmed.split(/(\s+)/).filter((t) => t.length > 0);
    const tokens: string[] = [];
    for (const t of rawTokens) {
      if (/^\s+$/.test(t)) continue;
      // Sépare un emoji collé à un mot : "journal📝" → "journal" + "📝"
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
      // Emoji juste après un mot : coller sans forcer une coupure
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

/**
 * Ajuste la taille pour remplir la zone. Si nbLignes est fourni, vise un wrap
 * proche de ce nombre (style source).
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  texte: string,
  maxW: number,
  maxH: number,
  family: string,
  nbLignesHint?: number,
): { size: number; lines: string[] } {
  const hiCap = Math.min(92, Math.max(22, Math.floor(maxH * 0.42)));
  let lo = 14;
  let hi = hiCap;
  let best = lo;
  let bestLines = [texte];

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    ctx.font = `700 ${mid}px ${family}`;
    let lines = wrapLines(ctx, texte, maxW, mid);

    // Si hint lignes : force un wrap plus serré en réduisant maxW virtuel
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

function dessinerLigne(
  ctx: CanvasRenderingContext2D,
  line: string,
  cx: number,
  cy: number,
  size: number,
  fill: string,
  stroke: string,
  avecOmbre: boolean,
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
        // Fallback texte (dernier recours) — police système
        ctx.fillStyle = fill;
        ctx.fillText(run.value, x, cy);
      }
      x += ew + size * 0.06;
      continue;
    }

    // Contour noir épais (Classic TikTok) puis fill
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = stroke;
    if (avecOmbre) {
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = size * 0.12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.max(1, size * 0.03);
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }
    ctx.strokeText(run.value, x, cy);
    ctx.fillStyle = fill;
    ctx.fillText(run.value, x, cy);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    x += ctx.measureText(run.value).width;
  }
}

/**
 * Dessine le texte traduit dans les zones (fractions 0..1) sur l'image propre.
 * Emojis = PNG Apple (iOS), pas la police système Android/Noto.
 */
export async function brulerTexteSurImage(
  propreUrl: string,
  zones: ZoneBurn[],
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

    // Zone utile : élargit un peu les boxes trop étroites (centrage Classic)
    let zx = z.x;
    let zw = z.w;
    if (zw < 0.72) {
      const cible = 0.84;
      zx = Math.max(0.04, (z.x + z.w / 2) - cible / 2);
      zw = Math.min(0.92, cible);
    }

    const x = zx * canvas.width;
    const y = z.y * canvas.height;
    const w = zw * canvas.width;
    // Hauteur min pour ne pas compresser un long paragraphe
    const h = Math.max(z.h * canvas.height, canvas.height * 0.22);
    const padX = w * 0.03;
    const padY = h * 0.04;
    const maxW = Math.max(8, w - padX * 2);
    const maxH = Math.max(8, h - padY * 2);

    const { size, lines } = fitFontSize(
      ctx,
      texte,
      maxW,
      maxH,
      family,
      z.nbLignes,
    );
    const lineH = size * 1.22;
    const blockH = lines.length * lineH;
    // Ancré plutôt vers le haut de la zone (comme TikTok), pas pile centré
    let cy = y + Math.max(padY, (h - blockH) * 0.15) + size * 0.85;
    const cx = x + w / 2;
    const fill = normaliserCouleur(z.couleur || "#FFFFFF");
    const stroke = contrasteStroke(fill);
    // Classic = toujours un contour lisible
    const avecOmbre = z.ombre !== false;

    ctx.font = `700 ${size}px ${family}`;
    for (const line of lines) {
      dessinerLigne(ctx, line, cx, cy, size, fill, stroke, avecOmbre);
      cy += lineH;
    }
  }

  return canvas.toDataURL("image/jpeg", 0.92);
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
