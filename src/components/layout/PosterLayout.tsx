import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";

import { ReviewPopup } from "@/features/reviews/ReviewPopup";
import { AppShell } from "./AppShell";

export function PosterLayout() {
  const { t } = useTranslation();
  return (
    <AppShell
      navLabel={t("nav.poster")}
      groups={[{ items: [{ to: "/calendrier", label: t("nav.calendrier"), icon: CalendarDays }] }]}
    >
      <ReviewPopup />
      <Outlet />
    </AppShell>
  );
}
