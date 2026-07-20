import { assertAuthorised, json, serviceClient } from "../_shared/supabase.ts";

/**
 * Gestion des comptes poster par l'admin. Créer un compte avec mot de passe
 * exige le service_role (supabase.auth.admin), donc ça vit forcément ici et
 * jamais dans le navigateur. assertAuthorised garantit que seul un admin appelle.
 *
 *   { action: "create", email, password, displayName }
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
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const displayName = (body.displayName ?? "").trim();

    if (!email || password.length < 8) {
      return json({ error: "Email requis et mot de passe d'au moins 8 caractères" }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName || email.split("@")[0] },
    });

    if (error) {
      const taken = error.message.toLowerCase().includes("already");
      return json({ error: taken ? "Un compte existe déjà avec cet email" : error.message }, 400);
    }

    // Le trigger a créé le profil (inactif par défaut) et le rôle poster.
    // Un compte créé par l'admin est validé d'emblée : on l'active.
    if (data.user) {
      await supabase.from("profiles").update({ is_active: true }).eq("id", data.user.id);
    }

    return json({ ok: true, userId: data.user?.id });
  }

  if (body.action === "delete") {
    const userId = body.userId;
    if (!userId) return json({ error: "userId requis" }, 400);

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) return json({ error: error.message }, 400);

    // Le cascade sur profiles/user_roles/assignments nettoie le reste.
    return json({ ok: true });
  }

  return json({ error: "action inconnue" }, 400);
});
