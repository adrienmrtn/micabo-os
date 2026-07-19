import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { SlideshowEditor } from "@/features/slideshows/SlideshowEditor";

export function AdminSlideshowDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  if (!id) return null;

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link to="/admin">{t("common.back")}</Link>
      </Button>
      <SlideshowEditor slideshowId={id} />
    </div>
  );
}
