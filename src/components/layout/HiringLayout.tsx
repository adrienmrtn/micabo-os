import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, HelpCircle, Rocket, UserPlus } from "lucide-react";

import { AppShell } from "./AppShell";

/** Coquille du hiring manager : créer des posters + ses guides et FAQ. */
export function HiringLayout() {
  const { t } = useTranslation();
  return (
    <AppShell
      navLabel={t("nav.hiring")}
      groups={[
        {
          items: [
            {
              to: "/embauche",
              label: t("nav.embauche"),
              icon: UserPlus,
              description: t("navDesc.embauche"),
            },
          ],
        },
        {
          title: t("documents.rubrique"),
          items: [
            { to: "/manager/guide", label: t("documents.guideManager"), icon: BookOpen },
            { to: "/manager/onboarding", label: t("documents.onboarding"), icon: Rocket },
            { to: "/manager/faq", label: t("documents.faq"), icon: HelpCircle },
          ],
        },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
