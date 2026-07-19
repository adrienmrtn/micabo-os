import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">{t("common.notFoundTitle")}</h1>
      <p className="text-muted-foreground">{t("common.notFoundBody")}</p>
    </div>
  );
}
