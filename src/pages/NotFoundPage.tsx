import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="surface-atelier flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="font-display text-3xl font-semibold tracking-tight">Sophia</p>
      <h1 className="text-lg font-semibold">{t("common.notFoundTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("common.notFoundBody")}</p>
    </div>
  );
}
