import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { FullPageLoader } from "@/components/layout/FullPageLoader";
import { signOut } from "./api";
import { useAuth } from "./AuthContext";

/**
 * Compte créé mais pas encore validé par un admin. L'inscription étant
 * ouverte, c'est ce mur qui empêche un inconnu tombé sur l'URL d'entrer.
 */
function PendingApproval() {
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
  const { user, profile, role, loading } = useAuth();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  // profile null = provisioning en cours, on laisse passer le temps du chargement.
  if (profile && !profile.is_active) return <PendingApproval />;
  if (!role) return <PendingApproval />;

  return <Outlet />;
}
