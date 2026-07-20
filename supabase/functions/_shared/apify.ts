const ACTOR = "clockworks~tiktok-scraper";

export interface ScrapedPost {
  postId: string;
  webVideoUrl: string;
  text: string;
  imageUrls: string[];
  musicUrl: string | null;
  createTime: number | null;
}

interface ApifyItem {
  id?: string;
  webVideoUrl?: string;
  text?: string;
  createTimeISO?: string;
  createTime?: number;
  imageUrlList?: string[];
  slideshowImageLinks?: Array<string | { downloadLink?: string; url?: string }>;
  musicMeta?: { playUrl?: string };
}

function normaliseImageLink(link: string | { downloadLink?: string; url?: string }) {
  if (typeof link === "string") return link;
  return link.downloadLink ?? link.url ?? null;
}

/**
 * Le scraper renvoie les visuels dans deux champs qui se tronquent
 * mutuellement selon les posts : on fusionne et on dédoublonne plutôt que de
 * faire confiance à l'un des deux.
 */
function mergeImageUrls(item: ApifyItem): string[] {
  const fromList = item.imageUrlList ?? [];
  const fromSlideshow = (item.slideshowImageLinks ?? [])
    .map(normaliseImageLink)
    .filter((url): url is string => Boolean(url));

  return [...new Set([...fromList, ...fromSlideshow])];
}

/**
 * Les visuels rapatriés par le scraper vivent dans le key-value store d'Apify,
 * qui répond 403 sans token et purge ses données après quelques jours. On les
 * télécharge donc pour les stocker chez nous.
 */
export async function downloadImage(url: string): Promise<Uint8Array> {
  const token = Deno.env.get("APIFY_TOKEN");
  const isApifyStore = url.startsWith("https://api.apify.com/");
  const target = isApifyStore && token ? `${url}?token=${token}` : url;

  const response = await fetch(target);
  if (!response.ok) {
    throw new Error(`Téléchargement image ${response.status} (${url.slice(0, 80)})`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function runActor(input: Record<string, unknown>): Promise<ScrapedPost[]> {
  const token = Deno.env.get("APIFY_TOKEN");
  if (!token) throw new Error("APIFY_TOKEN manquant");

  const response = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shouldDownloadSlideshowImages: true,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        proxyCountryCode: "None",
        ...input,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Apify ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const items = (await response.json()) as ApifyItem[];

  return items
    .map((item) => ({
      postId: item.id ?? "",
      webVideoUrl: item.webVideoUrl ?? "",
      text: item.text ?? "",
      imageUrls: mergeImageUrls(item),
      musicUrl: item.musicMeta?.playUrl ?? null,
      createTime: item.createTime ?? null,
    }))
    // Seuls les posts photo nous intéressent : une vidéo n'a pas de slides.
    .filter((post) => post.postId && post.imageUrls.length > 0);
}

export function scrapeProfile(handle: string, resultsPerPage: number) {
  return runActor({ profiles: [handle], resultsPerPage });
}

/** Scrape un seul post par son URL, pour tester le pipeline sur un TikTok précis. */
export function scrapePost(url: string) {
  return runActor({ postURLs: [url], resultsPerPage: 1 });
}
