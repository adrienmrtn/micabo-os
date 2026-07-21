import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/components/layout/FullPageLoader";
import { signOut } from "./api";
import { ChangePasswordPage } from "./ChangePasswordPage";
import { useAuth } from "./AuthContext";

/** Compte existant mais pas encore activé par un admin. */
function EnAttente() {
  const { t } = useTranslation();
  return (
    <div className="surface-gradient flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">{t("auth.pendingTitle")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("auth.pendingBody")}</p>
      <Button variant="outline" onClick={() => signOut()}>
        {t("auth.logout")}
      </Button>
    </div>
  );
}

export function ProtectedRoute() {
  const { user, profil, role, loading } = useAuth();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  // profil null = provisioning encore en cours, on laisse passer le chargement.
  if (profil && !profil.is_active) return <EnAttente />;
  if (!role) return <EnAttente />;

  // Le mot de passe reste celui donné par l'admin, le même pour tous : la
  // création de compte ne lève donc jamais ce drapeau. Le passage est conservé
  // pour qu'un admin puisse forcer un changement sur un compte précis.
  if (profil?.must_change_password) return <ChangePasswordPage />;

  return <Outlet />;
}
