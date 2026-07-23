import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, CalendarDays, HelpCircle } from "lucide-react";

import { ReviewPopup } from "@/features/reviews/ReviewPopup";
import { AppShell } from "./AppShell";

export function PosterLayout() {
  const { t } = useTranslation();
  return (
    <AppShell
      navLabel={t("nav.poster")}
      groups={[
        { items: [{ to: "/calendrier", label: t("nav.calendrier"), icon: CalendarDays }] },
        {
          title: t("documents.rubrique"),
          items: [
            { to: "/createur/guide", label: t("documents.guideCreateur"), icon: BookOpen },
            { to: "/createur/faq", label: t("documents.faq"), icon: HelpCircle },
          ],
        },
      ]}
    >
      <ReviewPopup />
      <Outlet />
    </AppShell>
  );
}
