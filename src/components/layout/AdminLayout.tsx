import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AtSign,
  BarChart3,
  CalendarDays,
  CalendarRange,
  Gauge,
  Images,
  MessageSquareQuote,
  Settings,
  Users,
  UserSquare,
  Wand2,
} from "lucide-react";

import { AppShell } from "./AppShell";

export function AdminLayout() {
  const { t } = useTranslation();
  return (
    <AppShell
      navLabel={t("nav.admin")}
      navItems={[
        { to: "/admin", label: t("nav.pilotage"), icon: Gauge },
        { to: "/admin/calendrier", label: t("nav.calendrier"), icon: CalendarDays },
        { to: "/admin/analytics", label: t("nav.analytics"), icon: BarChart3 },
        { to: "/admin/posts", label: t("nav.posts"), icon: CalendarRange },
        { to: "/admin/sources", label: t("nav.sources"), icon: AtSign },
        { to: "/admin/comptes", label: t("nav.comptes"), icon: UserSquare },
        { to: "/admin/posters", label: t("nav.posters"), icon: Users },
        { to: "/admin/bibliotheque", label: t("nav.bibliotheque"), icon: Images },
        { to: "/admin/test-nettoyage", label: t("nav.testNettoyage"), icon: Wand2 },
        { to: "/admin/reglages", label: t("nav.reglages"), icon: Settings },
        { to: "/admin/prompts", label: t("nav.prompts"), icon: MessageSquareQuote },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
