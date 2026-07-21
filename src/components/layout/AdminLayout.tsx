import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AtSign, Gauge, Images, MessageSquareQuote, Settings, Users, UserSquare } from "lucide-react";

import { AppShell } from "./AppShell";

export function AdminLayout() {
  const { t } = useTranslation();
  return (
    <AppShell
      navLabel={t("nav.admin")}
      navItems={[
        { to: "/admin", label: t("nav.pilotage"), icon: Gauge },
        { to: "/admin/sources", label: t("nav.sources"), icon: AtSign },
        { to: "/admin/comptes", label: t("nav.comptes"), icon: UserSquare },
        { to: "/admin/posters", label: t("nav.posters"), icon: Users },
        { to: "/admin/bibliotheque", label: t("nav.bibliotheque"), icon: Images },
        { to: "/admin/reglages", label: t("nav.reglages"), icon: Settings },
        { to: "/admin/prompts", label: t("nav.prompts"), icon: MessageSquareQuote },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
