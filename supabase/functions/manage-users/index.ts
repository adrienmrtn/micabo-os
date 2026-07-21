import { assertAuthorised, json, serviceClient } from "../_shared/supabase.ts";

const DOMAINE = "sophia.com";

/**
 * Gestion des posters par l'admin. Créer un compte avec mot de passe exige le
 * service_role, donc ça vit ici et jamais dans le navigateur.
 *
 *   { action: "create", prenom, nom, password }
 *   { action: "delete", userId }
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

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

    if (error) return json({ error: error.message }, 400);

    // Le trigger a posé le profil et le rôle poster. On complète l'état civil
    // et on active le compte : c'est l'admin qui l'a créé, il est validé.
    if (data.user) {
      await supabase
        .from("profiles")
        .update({ prenom, nom: nom || null, is_active: true, must_change_password: true })
        .eq("id", data.user.id);
    }

    return json({ ok: true, userId: data.user?.id, email });
  }

  if (body.action === "delete") {
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
 * `prenom + première lettre du nom @domaine`, suffixé d'un numéro si l'adresse
 * est déjà prise — deux homonymes ne doivent pas se bloquer mutuellement.
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
