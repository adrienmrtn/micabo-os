import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DeliveryView } from "@/features/slideshows/DeliveryView";

export function PosterDeliveryPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  if (!id) return null;

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link to="/dashboard">{t("common.back")}</Link>
      </Button>
      <DeliveryView slideshowId={id} />
    </div>
  );
}
