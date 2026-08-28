import * as React from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import { AuthLayout } from "./AuthLayout";
import { useAuth } from "./AuthContext";

/** Première connexion : le mot de passe vient de l'admin, le poster choisit le sien. */
export function ChangePasswordPage() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [motDePasse, setMotDePasse] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [enCours, setEnCours] = React.useState(false);
  const [erreur, setErreur] = React.useState<string | null>(null);

  async function soumettre(event: React.FormEvent) {
    event.preventDefault();
    setErreur(null);

    if (motDePasse !== confirmation) {
      setErreur(t("auth.mismatch"));
      return;
    }

    setEnCours(true);
    const { error } = await supabase.auth.updateUser({ password: motDePasse });

    if (error) {
      setEnCours(false);
      setErreur(error.message);
      return;
    }

    await supabase
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user!.id);

    setEnCours(false);
    refresh();
  }

  return (
    <AuthLayout title={t("auth.changeTitle")} description={t("auth.changeBody")}>
      <form onSubmit={soumettre} className="space-y-4">
        <Field>
          <FieldLabel htmlFor="mdp">{t("auth.newPassword")}</FieldLabel>
          <Input
            id="mdp"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="mdp2">{t("auth.confirmPassword")}</FieldLabel>
          <Input
            id="mdp2"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </Field>

        {erreur && (
          <Alert variant="error">
            <AlertDescription>{erreur}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" size="lg" className="w-full" loading={enCours}>
          {enCours ? t("common.saving") : t("auth.save")}
        </Button>
      </form>
    </AuthLayout>
  );
}
