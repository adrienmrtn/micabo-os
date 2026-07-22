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
        { to: "/admin", label: t("nav.pilotage"), icon: Gauge, description: t("navDesc.pilotage") },
        {
          to: "/admin/calendrier",
          label: t("nav.calendrier"),
          icon: CalendarDays,
          description: t("navDesc.calendrier"),
        },
        {
          to: "/admin/analytics",
          label: t("nav.analytics"),
          icon: BarChart3,
          description: t("navDesc.analytics"),
        },
        { to: "/admin/posts", label: t("nav.posts"), icon: CalendarRange, description: t("navDesc.posts") },
        { to: "/admin/sources", label: t("nav.sources"), icon: AtSign, description: t("navDesc.sources") },
        {
          to: "/admin/comptes",
          label: t("nav.comptes"),
          icon: UserSquare,
          description: t("navDesc.comptes"),
        },
        { to: "/admin/posters", label: t("nav.posters"), icon: Users, description: t("navDesc.posters") },
        {
          to: "/admin/bibliotheque",
          label: t("nav.bibliotheque"),
          icon: Images,
          description: t("navDesc.bibliotheque"),
        },
        {
          to: "/admin/test-nettoyage",
          label: t("nav.testNettoyage"),
          icon: Wand2,
          description: t("navDesc.testNettoyage"),
        },
        {
          to: "/admin/reglages",
          label: t("nav.reglages"),
          icon: Settings,
          description: t("navDesc.reglages"),
        },
        {
          to: "/admin/prompts",
          label: t("nav.prompts"),
          icon: MessageSquareQuote,
          description: t("navDesc.prompts"),
        },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
