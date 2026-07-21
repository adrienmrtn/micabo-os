import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        <div className="space-y-2">
          <Label htmlFor="mdp">{t("auth.newPassword")}</Label>
          <Input
            id="mdp"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mdp2">{t("auth.confirmPassword")}</Label>
          <Input
            id="mdp2"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>

        {erreur && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erreur}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={enCours}>
          {enCours ? t("common.saving") : t("auth.save")}
        </Button>
      </form>
    </AuthLayout>
  );
}
