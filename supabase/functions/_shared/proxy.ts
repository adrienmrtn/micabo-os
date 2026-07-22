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
/** Un échec temporaire (Gemini surchargé) : ça vaut la peine de réessayer. */
function estTransitoire(status: number, corps: string): boolean {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  return /unavailable|overloaded|no image generated|rate.?limit|try again|timeout/i.test(corps);
}

export async function nettoyerViaProxy(imageUrl: string): Promise<string | null> {
  const token = Deno.env.get("CLEAN_PHOTO_PROXY_TOKEN");
  if (!token) return null;

  const resImg = await fetch(imageUrl);
  if (!resImg.ok) throw new Error(`image source ${resImg.status}`);
  const base64 = enBase64(new Uint8Array(await resImg.arrayBuffer()));
  const corpsRequete = JSON.stringify({ image_base64: base64, strip_metadata: true });

  // Essais avec attente croissante + JITTER aléatoire, et surtout un TIMEOUT par
  // tentative. Trois problèmes distincts sous forte charge parallèle :
  //  - 503 « Service temporarily unavailable » : passager, on réessaie.
  //  - Le jitter évite que tous les réessais se percutent au même instant
  //    (effet « troupeau ») : chaque réessai est décalé d'un délai aléatoire.
  //  - Un appel qui PEND (Gemini saturé garde la connexion ouverte sans jamais
  //    répondre) : sans timeout, il bloquerait jusqu'au mur de 150 s de l'Edge
  //    Function et tuerait toute l'invocation AVANT le repli. On le coupe à
  //    TIMEOUT_TENTATIVE et on le traite comme un échec transitoire → réessai.
  // Un budget global borne le total bien en deçà du mur de 150 s : on préfère
  // rendre la main (l'appelant fait alors son repli) plutôt que se faire tuer.
  const TIMEOUT_TENTATIVE = 70_000;
  const BUDGET_TOTAL = 125_000;
  const debut = Date.now();

  let dernier = "";
  for (let essai = 0; essai < 5; essai += 1) {
    if (essai > 0) {
      const attente = 2000 * essai + Math.floor(Math.random() * 2000);
      await new Promise((r) => setTimeout(r, attente));
    }
    // Plus assez de budget pour une tentative complète : on s'arrête net.
    if (Date.now() - debut > BUDGET_TOTAL - 5_000) break;

    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), TIMEOUT_TENTATIVE);
    try {
      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-proxy-token": token },
        body: corpsRequete,
        signal: controleur.signal,
      });
      const texte = await res.text();
      let data: { success?: boolean; image_base64?: string } | null = null;
      try {
        data = JSON.parse(texte);
      } catch {
        // réponse non-JSON
      }

      if (res.ok && data?.success && data.image_base64) return data.image_base64;

      dernier = `proxy ${res.status}: ${texte.slice(0, 200)}`;
      // Refus de contenu ou requête invalide : inutile de réessayer.
      if (!estTransitoire(res.status, texte)) throw new Error(dernier);
    } catch (erreur) {
      // Un abort (timeout) est un échec transitoire : on réessaie. Toute autre
      // erreur non transitoire (refus de contenu déjà jeté ci-dessus) remonte.
      if ((erreur as Error)?.name === "AbortError") {
        dernier = `proxy: pas de réponse en ${TIMEOUT_TENTATIVE / 1000}s (surchargé)`;
      } else {
        throw erreur;
      }
    } finally {
      clearTimeout(minuteur);
    }
  }
  throw new Error(`${dernier} (après réessais)`);
}
