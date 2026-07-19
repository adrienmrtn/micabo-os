import * as React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineBadge } from "./PipelineBadge";
import { useRetryPipeline, useSlideshows } from "./hooks";
import type { PipelineStatus } from "./types";

const FILTERS: Array<{ key: string; status?: PipelineStatus }> = [
  { key: "all", status: undefined },
  { key: "pending", status: "pending" },
  { key: "running", status: "running" },
  { key: "done", status: "done" },
  { key: "failed", status: "failed" },
];

export function SlideshowsOverview() {
  const { t, i18n } = useTranslation();
  const [activeFilter, setActiveFilter] = React.useState(FILTERS[0]);
  const { data: slideshows, isPending, isError, error } = useSlideshows(activeFilter.status);
  const retry = useRetryPipeline();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("slideshows.title")}</CardTitle>
        <div className="flex flex-wrap gap-2 pt-2">
          {FILTERS.map((filter) => (
            <Button
              key={filter.key}
              size="sm"
              variant={filter.key === activeFilter.key ? "default" : "outline"}
              onClick={() => setActiveFilter(filter)}
            >
              {t(`slideshows.filter.${filter.key}`)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
        {isError && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {slideshows?.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("slideshows.empty")}</p>
        )}

        {slideshows?.map((slideshow) => (
          <div key={slideshow.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">
                  {slideshow.title || slideshow.hook_title || t("slideshows.untitled")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[
                    slideshow.tiktok_accounts?.handle
                      ? `@${slideshow.tiktok_accounts.handle}`
                      : null,
                    slideshow.profiles?.display_name ?? t("slideshows.unassigned"),
                    slideshow.assigned_date
                      ? new Date(slideshow.assigned_date).toLocaleDateString(i18n.language)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <PipelineBadge status={slideshow.auto_pipeline_status} />
            </div>

            {slideshow.auto_pipeline_error && (
              <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                {slideshow.auto_pipeline_error}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to={`/admin/slideshows/${slideshow.id}`}>
                  {t("slideshows.open")}
                </Link>
              </Button>
              {slideshow.auto_pipeline_status === "failed" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(slideshow.id)}
                >
                  {t("slideshows.retry")}
                </Button>
              )}
              {slideshow.posted_at && (
                <span className="self-center text-xs text-emerald-600">
                  {t("slideshows.posted")}
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
