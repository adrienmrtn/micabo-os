import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarCheck, CheckCircle2, Flame } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/card";
import { useAuth } from "@/features/auth/AuthContext";
import { useMySlideshowsToday } from "./hooks";

/**
 * La carte centrale du poster : ce qu'il doit publier aujourd'hui. C'est la
 * seule surface de l'app qui a le droit d'être aussi appuyée visuellement —
 * tout le reste est secondaire.
 */
export function TodayCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: slideshows, isPending } = useMySlideshowsToday(user?.id);

  if (isPending) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-36 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!slideshows || slideshows.length === 0) {
    return (
      <EmptyState
        icon={<CalendarCheck className="size-5" />}
        title={t("today.emptyTitle")}
        description={t("today.emptyBody")}
      />
    );
  }

  const remaining = slideshows.filter((slideshow) => !slideshow.posted_at).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Flame className="size-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">
          {t("today.title", { count: slideshows.length })}
        </h2>
        {remaining > 0 && (
          <Badge variant="warning">{t("today.remaining", { count: remaining })}</Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {slideshows.map((slideshow) => {
          const posted = Boolean(slideshow.posted_at);

          return (
            <Card
              key={slideshow.id}
              className={
                posted
                  ? "opacity-70"
                  : "border-primary/30 bg-gradient-to-br from-primary/[0.07] to-transparent shadow-lifted"
              }
            >
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug">
                      {slideshow.hook_title || slideshow.title || t("today.untitled")}
                    </p>
                    {posted && <CheckCircle2 className="size-5 shrink-0 text-success" />}
                  </div>

                  {slideshow.suggested_creator_handle && (
                    <Badge variant="secondary">
                      @{slideshow.suggested_creator_handle}
                    </Badge>
                  )}
                </div>

                {posted ? (
                  <p className="text-sm font-medium text-success">
                    {t("today.alreadyPosted")}
                  </p>
                ) : (
                  <Button asChild size="lg" className="w-full">
                    <Link to={`/slideshows/${slideshow.id}`}>
                      {t("today.open")}
                      <ArrowRight />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
