import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, CalendarDays, FilePenLine, HelpCircle, Rocket, UserPlus, Users } from "lucide-react";

import { useAuth } from "@/features/auth/AuthContext";
import { AppShell } from "./AppShell";

/** Coquille HM / DM : créer des posters + guides. Le DM a 2 entrées en plus. */
export function HiringLayout() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const estDm = role === "directing_manager";

  return (
    <AppShell
      navLabel={estDm ? t("hiring.badgeDm") : t("hiring.badgeHm")}
      groups={[
        {
          items: [
            {
              to: "/embauche",
              label: t("nav.embauche"),
              icon: UserPlus,
              description: t("navDesc.embauche"),
            },
            {
              to: "/manager/calendrier",
              label: t("hiring.calendrierNav"),
              icon: CalendarDays,
              description: t("hiring.calendrierSous"),
            },
            ...(estDm
              ? [
                  {
                    to: "/manager/recruteurs",
                    label: t("hiring.creerHm"),
                    icon: Users,
                    description: t("hiring.creerHmDesc"),
                  },
                  {
                    to: "/manager/documents",
                    label: t("hiring.docsOnboarding"),
                    icon: FilePenLine,
                    description: t("hiring.docsOnboardingDesc"),
                  },
                ]
              : []),
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
