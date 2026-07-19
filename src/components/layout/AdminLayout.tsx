import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AtSign, LayoutGrid, MessageSquareQuote, Users } from "lucide-react";

import { AppShell } from "./AppShell";

export function AdminLayout() {
  const { t } = useTranslation();
  return (
    <AppShell
      navLabel={t("nav.admin")}
      navItems={[
        { to: "/admin", label: t("nav.slideshows"), icon: LayoutGrid },
        { to: "/admin/accounts", label: t("nav.accounts"), icon: AtSign },
        { to: "/admin/users", label: t("nav.users"), icon: Users },
        { to: "/admin/prompts", label: t("nav.prompts"), icon: MessageSquareQuote },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
