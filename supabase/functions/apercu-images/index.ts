/**
 * Aperçu d'images du stockage, en base64 (02/10/2026) — LECTURE SEULE.
 *
 *   { chemins: string[], largeur?: number } → { ok, images: [{ chemin, b64 | erreur }] }
 *
 * L'environnement de travail ne joint pas `supabase.co` (proxy) et `pg_net`
 * tronque un corps binaire au premier octet nul : pour REGARDER une image avant
 * d'en décider (nettoyage, garnissage), il faut qu'elle revienne en texte. Les
 * chemins sont relatifs au bucket `medias` ; l'image est réduite par le rendu
 * du Storage (`largeur`, 360 par défaut) pour tenir dans une réponse.
 *
 * Fonction autonome, sans `_shared` : rien à empaqueter, rien qui bouge quand le
 * moteur change.
 */

const BASE = "https://qkmiwnmiwsvwkttldqgb.supabase.co/storage/v1/render/image/public/medias/";

function b64(octets: Uint8Array): string {
  let s = "";
  for (let i = 0; i < octets.length; i += 0x8000) {
    s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

Deno.serve(async (request) => {
  const attendu = Deno.env.get("CRON_SECRET");
  if (!attendu || request.headers.get("x-cron-secret") !== attendu) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const corps = await request.json().catch(() => ({}));
  const chemins = (Array.isArray(corps?.chemins) ? corps.chemins : []).map(String).slice(0, 12);
  const largeur = Math.min(Math.max(Number(corps?.largeur ?? 360), 120), 720);
  const images = await Promise.all(chemins.map(async (chemin: string) => {
    if (chemin.includes("..") || chemin.startsWith("/")) return { chemin, erreur: "chemin refusé" };
    try {
      const r = await fetch(`${BASE}${chemin}?width=${largeur}&quality=70`);
      if (!r.ok) return { chemin, erreur: `HTTP ${r.status}` };
      return { chemin, b64: b64(new Uint8Array(await r.arrayBuffer())) };
    } catch (e) {
      return { chemin, erreur: String(e).slice(0, 200) };
    }
  }));
  return new Response(JSON.stringify({ ok: true, images }), {
    headers: { "content-type": "application/json" },
  });
});
