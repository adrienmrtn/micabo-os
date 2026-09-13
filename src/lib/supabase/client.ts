import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Deliberately not thrown: throwing here would blow up at module-evaluation
  // time and blank the whole app before React even mounts. A placeholder
  // client lets the UI render; real Supabase calls just fail until .env is set.
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill in your project's values.",
  );
}

/**
 * Aucune réponse de l'API ne doit dormir dans le cache du navigateur.
 *
 * PostgREST ne renvoie **aucun `Cache-Control`** (vérifié : ni `Cache-Control`,
 * ni `ETag`, ni `Last-Modified`). Sans consigne, le navigateur applique sa
 * fraîcheur heuristique et peut donc stocker et resservir la réponse. Le
 * 12/09/2026 ça a donné le pire scénario possible : le serveur était réparé,
 * les requêtes étaient justes, et le profil d'Adrien continuait de rejouer les
 * réponses de la version cassée. En navigation privée — cache vierge — tout
 * marchait. Un F5 ne change rien : `fetch()` a sa propre fraîcheur, il ne
 * revalide pas parce qu'on recharge la page.
 *
 * `cache: "no-store"` règle les deux moitiés du problème :
 * - la réponse n'est plus écrite dans le cache ;
 * - la requête ne lit plus le cache, donc un profil déjà empoisonné se répare
 *   au premier chargement, sans vider quoi que ce soit à la main.
 *
 * C'est de toute façon ce qu'on veut pour une API authentifiée et filtrée par
 * RLS : la réponse dépend de QUI demande, elle n'a rien à faire dans un cache
 * partagé par URL.
 */
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  },
);
