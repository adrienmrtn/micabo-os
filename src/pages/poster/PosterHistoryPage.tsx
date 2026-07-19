import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/AuthContext";
import { useMySlideshows } from "@/features/slideshows/hooks";

export function PosterHistoryPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data: slideshows, isPending } = useMySlideshows(user?.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("history.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
        {slideshows?.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
        )}

        {slideshows?.map((slideshow) => (
          <div
            key={slideshow.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {slideshow.hook_title || slideshow.title || t("today.untitled")}
              </p>
              <p className="text-xs text-muted-foreground">
                {slideshow.assigned_date
                  ? new Date(slideshow.assigned_date).toLocaleDateString(i18n.language)
                  : "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {slideshow.posted_at ? (
                <Badge variant="success">{t("history.posted")}</Badge>
              ) : (
                <Badge variant="warning">{t("history.toPost")}</Badge>
              )}
              <Button size="sm" variant="outline" asChild>
                <Link to={`/slideshows/${slideshow.id}`}>{t("history.open")}</Link>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
