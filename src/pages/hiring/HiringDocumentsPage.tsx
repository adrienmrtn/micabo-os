import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/AuthContext";
import { AdminDocumentsPage } from "@/pages/admin/AdminDocumentsPage";

/** Docs d’onboarding / guides manager — directing manager seulement. */
export function HiringDocumentsPage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  if (role !== "directing_manager") return <Navigate to="/embauche" replace />;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("hiring.docsOnboarding")}</CardTitle>
          <CardDescription>{t("hiring.docsOnboardingDesc")}</CardDescription>
        </CardHeader>
      </Card>
      <AdminDocumentsPage audiences={["manager", "all"]} masquerEnTete />
    </div>
  );
}
