import { useTranslation } from "react-i18next";

import { BrandLogo } from "@/components/brand/BrandLogo";
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
          <BrandLogo size="lg" className="mb-6" />
          <EmptyTitle>{t("common.notFoundTitle")}</EmptyTitle>
          <EmptyDescription>{t("common.notFoundBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
