import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarClock, Flame } from "lucide-react";

import { AppShell } from "./AppShell";

export function PosterLayout() {
  const { t } = useTranslation();
  return (
    <AppShell
      navLabel={t("nav.poster")}
      navItems={[
        { to: "/dashboard", label: t("nav.today"), icon: Flame },
        { to: "/history", label: t("nav.history"), icon: CalendarClock },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
