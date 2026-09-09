import { extraireIdTiktok, estLienCourtTiktok } from "../_shared/tiktok_lien.ts";
import { assertRole, json, messageErreur } from "../_shared/supabase.ts";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";
const SAUTS_MAX = 5;

/**
 * Résout un lien court TikTok (vm./vt./t.) → id photo/vidéo pour l'embed.
 * Ne persiste rien.
 *
 *   { url } → { ok, id, url }
 */
Deno.serve(async (request) => {
  const acces = await assertRole(request, ["admin"]);
  if (acces instanceof Response) return acces;

  try {
    const body = await request.json();
    const brut = String(body?.url ?? "").trim();
    if (!brut) return json({ error: "URL vide" }, 400);

    const direct = extraireIdTiktok(brut);
    if (direct) return json({ ok: true, id: direct, url: brut });
    if (!estLienCourtTiktok(brut)) {
      return json({ ok: false, error: "Pas un lien TikTok court" }, 400);
    }

    const canon = await suivreRedirections(brut);
    const id = extraireIdTiktok(canon);
    if (!id) return json({ ok: false, error: "ID TikTok introuvable" }, 422);
    return json({ ok: true, id, url: canon });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});

async function suivreRedirections(depart: string): Promise<string> {
  let actuel = depart;
  for (let i = 0; i < SAUTS_MAX; i++) {
    if (extraireIdTiktok(actuel)) return actuel;
    const res = await fetch(actuel, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": UA },
    });
    const loc = res.headers.get("location");
    if (!loc) return res.url || actuel;
    actuel = new URL(loc, actuel).toString();
  }
  return actuel;
}
