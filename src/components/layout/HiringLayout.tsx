import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";

import { AppShell } from "./AppShell";

/** Coquille du hiring manager : un seul écran, créer des posters. */
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
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
