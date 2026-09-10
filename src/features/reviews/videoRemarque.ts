/**
 * Vidéo d'explication d'une puce générique : du fichier déposé au MP4 servi.
 *
 * Deux raisons de toujours réencoder plutôt que de servir le fichier tel quel :
 *
 *   1. un screen recording macOS sort en `.mov`, parfois en HEVC — Safari le
 *      lit, Chrome et beaucoup d'Android non. Le créateur verrait un cadre noir ;
 *   2. quinze secondes d'écran non compressées pèsent des dizaines de méga-
 *      octets, et ça se télécharge sur le forfait mobile d'un créateur.
 *
 * On sort donc du H.264 `yuv420p` en MP4, `faststart` (l'index en tête, sinon
 * la lecture attend le fichier entier), redimensionné et **sans piste audio** —
 * le retour est muet par choix, et c'est ce qui autorise la lecture automatique
 * sur iPhone.
 */

/** Au-delà, c'est un export vidéo, pas une explication de quinze secondes. */
export const SOURCE_OCTETS_MAX = 300 * 1024 * 1024;
/** Durée gardée : le reste est coupé plutôt que refusé. */
export const DUREE_MAX_SEC = 30;
/** Largeur de sortie : lisible sur téléphone sans peser. */
export const LARGEUR_MAX = 720;

const EXTENSIONS = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;

export type MotifRefus = "vide" | "pas_une_video" | "trop_gros";

/**
 * Le fichier est-il exploitable ? On reste large sur le type MIME : selon le
 * navigateur et le système, un `.mov` arrive en `video/quicktime`, en
 * `application/octet-stream`, ou sans type du tout.
 */
export function refusFichierVideo(fichier: {
  name: string;
  size: number;
  type: string;
}): MotifRefus | null {
  if (!fichier.size) return "vide";
  const typeOk = fichier.type.startsWith("video/");
  const extOk = EXTENSIONS.test(fichier.name);
  if (!typeOk && !extOk) return "pas_une_video";
  if (fichier.size > SOURCE_OCTETS_MAX) return "trop_gros";
  return null;
}

/**
 * Args ffmpeg.wasm. `-an` retire l'audio : muet par choix produit, et la
 * lecture automatique iOS n'est permise que sans son.
 *
 * `scale` ne fait que réduire (`min(LARGEUR_MAX,iw)`) — agrandir une capture
 * ajouterait du poids sans ajouter un pixel d'information. `-2` laisse ffmpeg
 * choisir une hauteur paire, exigée par `yuv420p`.
 */
export function argsFfmpegRemarque(dureeMaxSec = DUREE_MAX_SEC): string[] {
  return [
    "-i",
    "in",
    "-t",
    String(dureeMaxSec),
    "-an",
    "-vf",
    `scale='min(${LARGEUR_MAX},iw)':-2`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "28",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "out.mp4",
  ];
}

/** Chemin storage d'une vidéo de puce — un id par puce, donc un fichier par puce. */
export function cheminVideoRemarque(remarqueId: string): string {
  return `reviews/remarques/${remarqueId}.mp4`;
}

export function formaterOctets(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

type FfmpegInstance = {
  loaded?: boolean;
  load: (opts: { coreURL: string; wasmURL: string }) => Promise<boolean>;
  writeFile: (name: string, data: Uint8Array) => Promise<boolean>;
  exec: (args: string[]) => Promise<number>;
  readFile: (name: string) => Promise<Uint8Array | string>;
  deleteFile: (name: string) => Promise<boolean>;
};

let ffmpegSingleton: FfmpegInstance | null = null;

async function chargerFfmpeg(onProgress?: (detail: string) => void): Promise<FfmpegInstance> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;
  onProgress?.("Chargement du compresseur (une fois, ~30 Mo)…");
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);
  const ffmpeg = new FFmpeg() as unknown as FfmpegInstance;
  const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ffmpegSingleton = ffmpeg;
  return ffmpeg;
}

/**
 * Réencode le fichier déposé en MP4 muet lisible partout.
 *
 * Si ffmpeg échoue (WebAssembly indisponible, codec exotique), on renvoie le
 * fichier d'origine plutôt que de bloquer l'admin : un `.mov` qui ne passe que
 * sur Safari reste préférable à pas de vidéo du tout, et le lecteur du créateur
 * signale de toute façon un format illisible.
 */
export async function preparerVideoRemarque(
  fichier: File,
  onProgress?: (detail: string) => void,
): Promise<{ blob: Blob; mime: string; reencode: boolean }> {
  try {
    const { fetchFile } = await import("@ffmpeg/util");
    const ffmpeg = await chargerFfmpeg(onProgress);
    onProgress?.(`Compression de ${formaterOctets(fichier.size)}…`);
    await ffmpeg.writeFile("in", await fetchFile(fichier));
    const code = await ffmpeg.exec(argsFfmpegRemarque());
    if (typeof code === "number" && code !== 0) throw new Error(`ffmpeg code=${code}`);
    const data = await ffmpeg.readFile("out.mp4");
    const octets = typeof data === "string" ? new TextEncoder().encode(data) : data;
    if (!octets.byteLength) throw new Error("sortie vide");
    // Copie : le tampon de ffmpeg.wasm est réutilisé d'un appel à l'autre.
    const copie = new Uint8Array(octets.byteLength);
    copie.set(octets);
    await ffmpeg.deleteFile("in").catch(() => {});
    await ffmpeg.deleteFile("out.mp4").catch(() => {});
    const blob = new Blob([copie], { type: "video/mp4" });
    onProgress?.(`Compressé : ${formaterOctets(blob.size)}`);
    return { blob, mime: "video/mp4", reencode: true };
  } catch (e) {
    console.warn("[video remarque] compression impossible, fichier gardé tel quel", e);
    onProgress?.("Compression impossible — fichier gardé tel quel");
    return { blob: fichier, mime: fichier.type || "video/mp4", reencode: false };
  }
}
