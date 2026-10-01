/**
 * Relevé des vues par lien : tous les posts dus d'un compte dans UN appel
 * Apify (`postURLs`), sans téléchargement d'image ni de vidéo.
 *
 * Séparé d'`apify.ts`, que tirent six autres bundles : y ajouter une fonction,
 * même élaguée, les faisait tous « changer » au rebuild (même raison
 * qu'`apify_usage.ts`).
 *
 * Avant (0281), un post se mesurait par le scrape du profil — vingt posts lus
 * pour en retrouver un ou deux — et, à défaut, par un `scrapePost` d'un lien à
 * la fois, images de slideshow téléchargées comprises. Ici on ne paie que les
 * posts demandés.
 */

const ACTOR = "clockworks~tiktok-scraper";

export interface PostReleve {
  postId: string;
  webVideoUrl: string;
  /** Le lien tel qu'on l'a demandé, quand l'actor le renvoie. */
  lienDemande?: string | null;
  createTime: number | null;
  stats: { vues: number; likes: number; commentaires: number; partages: number };
}

type ItemApify = {
  id?: string;
  webVideoUrl?: string;
  submittedVideoUrl?: string;
  createTime?: number;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
};

export async function releverPostsParLien(urls: string[]): Promise<PostReleve[]> {
  if (urls.length === 0) return [];
  const token = Deno.env.get("APIFY_TOKEN");
  if (!token) throw new Error("APIFY_TOKEN manquant");

  const response = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postURLs: urls,
        // Sans effet sur `postURLs` d'après l'actor ; posé au nombre de liens
        // pour qu'aucune version ne coupe le lot à un seul résultat.
        resultsPerPage: urls.length,
        shouldDownloadSlideshowImages: false,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
        proxyCountryCode: "None",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Apify ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const items = (await response.json()) as ItemApify[];
  return items
    .filter((item) => item.id)
    .map((item) => ({
      postId: item.id ?? "",
      webVideoUrl: item.webVideoUrl ?? "",
      lienDemande: item.submittedVideoUrl ?? null,
      createTime: item.createTime ?? null,
      stats: {
        vues: item.playCount ?? 0,
        likes: item.diggCount ?? 0,
        commentaires: item.commentCount ?? 0,
        partages: item.shareCount ?? 0,
      },
    }));
}
