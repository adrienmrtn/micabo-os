import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AtSign,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCheck,
  FlaskConical,
  Gauge,
  Gift,
  GitCompare,
  Hourglass,
  Images,
  Inbox,
  ListOrdered,
  MessageCircle,
  MessageSquareQuote,
  MoonStar,
  Settings,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";

import { AppShell } from "./AppShell";

export function AdminLayout() {
  const { t } = useTranslation();
  return (
    <AppShell
      navLabel={t("nav.admin")}
      groups={[
        {
          items: [
            { to: "/admin", label: t("nav.pilotage"), icon: Gauge, description: t("navDesc.pilotage") },
          ],
        },
        {
          title: t("navSection.production"),
          items: [
            {
              to: "/admin/calendrier",
              label: t("nav.calendrier"),
              icon: CalendarDays,
              description: t("navDesc.calendrier"),
            },
            {
              to: "/admin/valider-jour",
              label: t("nav.validerJour"),
              icon: CheckCheck,
              description: t("navDesc.validerJour"),
            },
            {
              to: "/admin/minuit",
              label: t("nav.minuit"),
              icon: MoonStar,
              description: t("navDesc.minuit"),
            },
            {
              to: "/admin/sources",
              label: t("nav.sources"),
              icon: AtSign,
              description: t("navDesc.sources"),
            },
            {
              to: "/admin/file",
              label: t("nav.file"),
              icon: Inbox,
              description: t("navDesc.file"),
            },
            {
              to: "/admin/slideshows",
              label: t("nav.slideshows"),
              icon: ListOrdered,
              description: t("navDesc.slideshows"),
            },
            {
              to: "/admin/bibliotheque",
              label: t("nav.bibliotheque"),
              icon: Images,
              description: t("navDesc.bibliotheque"),
            },
          ],
        },
        {
          title: t("navSection.ugc"),
          items: [
            {
              to: "/admin/ugc/personas",
              label: t("nav.ugcPersonas"),
              icon: UserRound,
              description: t("navDesc.ugcPersonas"),
            },
          ],
        },
        {
          title: t("navSection.tests"),
          items: [
            { to: "/admin/tests", label: t("nav.tests"), icon: FlaskConical, description: t("navDesc.tests") },
          ],
        },
        {
          title: t("navSection.suivi"),
          items: [
            {
              to: "/admin/analytics",
              label: t("nav.analytics"),
              icon: BarChart3,
              description: t("navDesc.analytics"),
            },
            { to: "/admin/posters", label: t("nav.posters"), icon: Users, description: t("navDesc.posters") },
            {
              to: "/admin/surveillance",
              label: t("nav.surveillance"),
              icon: ShieldAlert,
              description: t("navDesc.surveillance"),
            },
            {
              to: "/admin/reviews",
              label: t("nav.reviews"),
              icon: MessageSquareQuote,
              description: t("navDesc.reviews"),
            },
            {
              to: "/admin/reviews-jour",
              label: t("nav.reviewsJour"),
              icon: GitCompare,
              description: t("navDesc.reviewsJour"),
            },
            {
              to: "/admin/essai",
              label: t("nav.essai"),
              icon: Hourglass,
              description: t("navDesc.essai"),
            },
            {
              to: "/admin/parrainages",
              label: t("nav.referral"),
              icon: Gift,
              description: t("navDesc.referral"),
            },
          ],
        },
        {
          title: t("navSection.config"),
          items: [
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
            {
              to: "/admin/documents",
              label: t("documents.nav"),
              icon: BookOpen,
              description: t("documents.navDesc"),
            },
            {
              to: "/admin/assistant",
              label: t("chatbot.nav"),
              icon: MessageCircle,
              description: t("chatbot.navDesc"),
            },
          ],
        },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
