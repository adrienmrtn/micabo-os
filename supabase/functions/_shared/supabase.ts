import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Client service_role : contourne la RLS. Réservé aux Edge Functions, qui sont
 * le seul endroit où le pipeline a le droit d'écrire dans les tables métier.
 */
export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Deux appelants légitimes, deux preuves différentes :
 *
 * - pg_cron n'a pas de session utilisateur, il présente un secret partagé
 *   (plus sûr que la clé anon, qui est publique par nature) ;
 * - un admin qui déclenche un run depuis l'interface présente son JWT, dont
 *   le rôle est vérifié côté base — le secret ne descend jamais au navigateur.
 */
export async function assertAuthorised(request: Request): Promise<Response | null> {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) {
    return json({ error: "CRON_SECRET non configuré" }, 500);
  }

  if (request.headers.get("x-cron-secret") === expected) return null;

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);

  const supabase = serviceClient();
  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) return json({ error: "unauthorized" }, 401);

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin");

  if (!roles || roles.length === 0) return json({ error: "forbidden" }, 403);

  return null;
}

/**
 * Charge un prompt éditable depuis l'admin. Renvoie undefined si absent, pour
 * que l'appelant retombe sur le défaut codé plutôt que d'envoyer un prompt vide.
 */
export async function chargerPrompt(
  supabase: ReturnType<typeof serviceClient>,
  cle: string,
): Promise<string | undefined> {
  const { data } = await supabase
    .from("prompts")
    .select("contenu")
    .eq("cle", cle)
    .maybeSingle();

  return data?.contenu?.trim() || undefined;
}

/**
 * Message lisible pour n'importe quoi qui a été jeté.
 *
 * `String(erreur)` sur une erreur Supabase donne « [object Object] » : le
 * pipeline enregistrait ça en base, et on ne pouvait plus savoir ce qui avait
 * échoué. On va donc chercher les champs que Postgrest et Storage remplissent.
 */
export function messageErreur(erreur: unknown): string {
  if (erreur instanceof Error) return erreur.message;

  if (erreur && typeof erreur === "object") {
    const e = erreur as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint, e.code].filter(Boolean);
    if (parts.length > 0) return parts.join(" · ");
    try {
      return JSON.stringify(erreur).slice(0, 400);
    } catch {
      // Objet non sérialisable (cycle) : on retombe sur String().
    }
  }

  return String(erreur);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Date du jour en YYYY-MM-DD (UTC — les crons raisonnent en UTC). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
