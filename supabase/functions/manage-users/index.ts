import { assertRole, json, serviceClient } from "../_shared/supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;
const DOMAINE = "sophia.com";

/**
 * Gestion des posters. Créer un compte avec mot de passe exige le service_role,
 * donc ça vit ici et jamais dans le navigateur.
 *
 * Deux appelants : l'admin, et le HIRING MANAGER (dont c'est le seul pouvoir).
 * Le hiring manager peut créer un poster mais pas en supprimer.
 *
 *   { action: "create", prenom, nom, password, langue? }
 *   { action: "delete", userId }        (admin uniquement)
 *
 * À la création, si une `langue` est fournie, tout ce qui concerne le compte de
 * publication est AUTOMATISÉ : on rattache un compte de référence de cette
 * langue (le moins chargé) et on génère la persona (pseudo, bio, avatar) via
 * l'IA, en s'inspirant du compte de référence.
 */
Deno.serve(async (request) => {
  const acces = await assertRole(request, ["admin", "hiring_manager"]);
  if (acces instanceof Response) return acces;

  const supabase = serviceClient();

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "corps JSON attendu" }, 400);
  }

  if (body.action === "create") {
    const prenom = (body.prenom ?? "").trim();
    const nom = (body.nom ?? "").trim();
    const password = body.password ?? "";
    const langue = (body.langue ?? "").trim().toLowerCase();
    // Rôle voulu : "poster" (défaut) ou "hiring_manager". Seul l'admin peut
    // créer un recruteur ; un recruteur ne crée que des posters.
    const roleVoulu =
      body.role === "hiring_manager" && acces.role === "admin" ? "hiring_manager" : "poster";

    if (!prenom || password.length < 8) {
      return json({ error: "Prénom requis et mot de passe d'au moins 8 caractères" }, 400);
    }

    const email = await emailDisponible(supabase, prenom, nom);

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { prenom },
    });

    if (error) {
      // `error.message` remonte parfois vide sur l'API admin : sans le code ni
      // le statut, le message affiché à l'admin est inexploitable.
      const detail = [error.message, error.code, error.status].filter(Boolean).join(" · ");
      return json({ error: detail || `Création refusée pour ${email}` }, 400);
    }

    // Le trigger a posé le profil et le rôle poster. On complète l'état civil
    // et on active le compte : c'est un accès validé de vive voix.
    if (data.user) {
      await supabase
        .from("profiles")
        // Pas de changement de mot de passe imposé : le mot de passe reste
        // 12345678 pour tout le monde, c'est un choix assumé sur un outil
        // interne où l'admin dicte les accès de vive voix.
        .update({ prenom, nom: nom || null, is_active: true, must_change_password: false })
        .eq("id", data.user.id);

      if (roleVoulu === "hiring_manager") {
        // Recruteur : on remplace le rôle poster par hiring_manager et on pose
        // sa nationalité (langue par défaut de ses futurs posters).
        await supabase.from("user_roles").delete().eq("user_id", data.user.id);
        await supabase.from("user_roles").insert({ user_id: data.user.id, role: "hiring_manager" });
        if (langue) {
          await supabase.from("profiles").update({ nationalite: langue }).eq("id", data.user.id);
        }
      } else if (acces.role === "hiring_manager" && acces.userId !== "cron") {
        // Poster créé par un recruteur : on mémorise qui le gère, pour le grouper
        // sous son recruteur dans la vue admin.
        await supabase
          .from("profiles")
          .update({ manager_id: acces.userId })
          .eq("id", data.user.id);
      }
    }

    // Automatisation IA du compte de publication (posters seulement, avec langue).
    let compte: { id: string; reference: string | null; persona: boolean } | null = null;
    if (data.user && roleVoulu === "poster" && langue) {
      compte = await preparerCompte(supabase, request, data.user.id, langue);
    }

    return json({ ok: true, userId: data.user?.id, email, compte, role: roleVoulu });
  }

  if (body.action === "delete") {
    // Suppression réservée à l'admin : un hiring manager ne défait pas.
    if (acces.role !== "admin") return json({ error: "forbidden" }, 403);
    if (!body.userId) return json({ error: "userId requis" }, 400);
    const { error } = await supabase.auth.admin.deleteUser(body.userId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "action inconnue" }, 400);
});

/** Retire accents et caractères parasites : un email doit rester saisissable. */
function normaliser(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * `prenom` collé à la première lettre du nom, puis `@domaine` — sans aucun
 * séparateur : `Test Poster` donne `testp@sophia.com`. `normaliser` retire
 * accents et ponctuation, un `+` ou un point ne peut donc pas s'y glisser.
 *
 * Suffixé d'un numéro si l'adresse est déjà prise : deux homonymes ne doivent
 * pas se bloquer mutuellement.
 */
async function emailDisponible(
  supabase: ReturnType<typeof serviceClient>,
  prenom: string,
  nom: string,
): Promise<string> {
  const base = normaliser(prenom) + normaliser(nom).slice(0, 1);

  for (let suffixe = 0; suffixe < 50; suffixe += 1) {
    const email = `${base}${suffixe || ""}@${DOMAINE}`;
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!data) return email;
  }

  return `${base}${Date.now()}@${DOMAINE}`;
}

/**
 * Prépare le compte de publication d'un poster tout juste créé : rattache un
 * compte de référence de la bonne langue et génère la persona via l'IA.
 *
 * Best-effort : si aucun compte de référence n'existe pour la langue, on crée
 * quand même le compte (référence nulle) ; si la persona échoue, le compte
 * existe et l'admin pourra la (re)générer. On ne bloque jamais la création du
 * poster pour un aléa d'automatisation.
 */
async function preparerCompte(
  supabase: Supabase,
  request: Request,
  posterId: string,
  langue: string,
): Promise<{ id: string; reference: string | null; persona: boolean }> {
  const referenceId = await referenceLaMoinsChargee(supabase, langue);

  const { data: compte, error } = await supabase
    .from("comptes")
    .insert({ poster_id: posterId, compte_reference_id: referenceId, langue })
    .select("id")
    .single();
  if (error || !compte) {
    return { id: "", reference: referenceId, persona: false };
  }

  const persona = await genererPersonaAuto(request, compte.id);
  return { id: compte.id, reference: referenceId, persona };
}

/**
 * Le compte de référence actif de la langue demandée qui porte le moins de
 * comptes de publication — pour répartir les posters au lieu d'empiler tout le
 * monde sur le premier. Renvoie null si la langue n'a aucun compte de référence.
 */
async function referenceLaMoinsChargee(
  supabase: Supabase,
  langue: string,
): Promise<string | null> {
  const { data: refs } = await supabase
    .from("comptes_reference")
    .select("id")
    .eq("langue", langue)
    .eq("is_active", true);
  if (!refs || refs.length === 0) return null;

  const { data: comptes } = await supabase
    .from("comptes")
    .select("compte_reference_id");
  const charge = new Map<string, number>();
  for (const c of comptes ?? []) {
    if (c.compte_reference_id) {
      charge.set(c.compte_reference_id, (charge.get(c.compte_reference_id) ?? 0) + 1);
    }
  }

  return refs
    .map((r) => r.id)
    .sort((a, b) => (charge.get(a) ?? 0) - (charge.get(b) ?? 0))[0];
}

/**
 * Déclenche la génération de persona (pseudo, bio, avatar) en appelant la
 * fonction `persona`, qui porte déjà toute la logique (filtrage des pseudos,
 * choix d'avatar sans visage). On l'appelle en interne avec le secret cron pour
 * ne pas ré-implémenter tout ça ici. Renvoie true si la persona a été appliquée.
 */
async function genererPersonaAuto(request: Request, compteId: string): Promise<boolean> {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return false;

  // URL de la fonction voisine, déduite de l'URL de la requête courante.
  const base = new URL(request.url);
  const url = `${base.origin}${base.pathname.replace(/manage-users\/?$/, "")}persona`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": secret },
      body: JSON.stringify({ compteId, appliquer: true }),
    });
    const data = await res.json().catch(() => null);
    return Boolean(data?.applique);
  } catch {
    return false;
  }
}
