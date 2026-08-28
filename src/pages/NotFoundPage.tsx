import { useTranslation } from "react-i18next";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6">
      <Empty>
        <EmptyHeader>
          <span className="brand-mark mb-6" aria-hidden>
            S
          </span>
          <EmptyTitle>{t("common.notFoundTitle")}</EmptyTitle>
          <EmptyDescription>{t("common.notFoundBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
