// Nettoyage via le proxy Lovable de l'utilisateur.
//
// Le proxy (son projet, son endpoint) porte la clé Lovable côté serveur : on ne
// manipule JAMAIS LOVABLE_API_KEY ici, seulement un token d'accès au proxy
// (CLEAN_PHOTO_PROXY_TOKEN). Le proxy prend une image et rend l'image nettoyée.

const PROXY_URL = "https://tmmikmclqslmkcukdpal.supabase.co/functions/v1/clean-photo-proxy";

function enBase64(bytes: Uint8Array): string {
  let binaire = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binaire += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binaire);
}

/**
 * Nettoie une image via le proxy. Renvoie l'image nettoyée en base64, ou null
 * si aucun token n'est configuré (l'appelant retombe alors sur l'autre voie).
 * Les vraies erreurs (proxy en échec, refus) remontent pour être visibles.
 */
export async function nettoyerViaProxy(imageUrl: string): Promise<string | null> {
  const token = Deno.env.get("CLEAN_PHOTO_PROXY_TOKEN");
  if (!token) return null;

  const resImg = await fetch(imageUrl);
  if (!resImg.ok) throw new Error(`image source ${resImg.status}`);
  const bytes = new Uint8Array(await resImg.arrayBuffer());

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-proxy-token": token },
    body: JSON.stringify({ image_base64: enBase64(bytes), strip_metadata: true }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success || !data?.image_base64) {
    throw new Error(`proxy ${res.status}: ${JSON.stringify(data ?? "").slice(0, 200)}`);
  }
  return data.image_base64 as string;
}
