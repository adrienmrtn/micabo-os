import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { PipelineBadge } from "@/features/slideshows/PipelineBadge";
import { SlideshowEditor } from "@/features/slideshows/SlideshowEditor";
import type { Slideshow } from "@/features/slideshows/types";

async function fetchSlideshow(id: string): Promise<Slideshow | null> {
  const { data } = await supabase.from("slideshows").select("*").eq("id", id).single();
  return (data as Slideshow) ?? null;
}

/** En-tête : d'un coup d'œil, où en est le slideshow et pourquoi. */
function StatusHeader({ id }: { id: string }) {
  const { t } = useTranslation();
  const { data: slideshow, isPending } = useQuery({
    queryKey: ["slideshow-row", id],
    queryFn: () => fetchSlideshow(id),
    // Tant que le pipeline tourne, on rafraîchit pour voir l'avancée.
    refetchInterval: (query) => {
      const status = (query.state.data as Slideshow | null)?.auto_pipeline_status;
      return status === "pending" || status === "running" ? 4000 : false;
    },
  });

  if (isPending || !slideshow) return null;

  const processing =
    slideshow.auto_pipeline_status === "pending" ||
    slideshow.auto_pipeline_status === "running";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{slideshow.title || t("slideshows.untitled")}</CardTitle>
          <PipelineBadge status={slideshow.auto_pipeline_status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {slideshow.relevance_score !== null && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={slideshow.relevance_score >= 50 ? "success" : "destructive"}>
              {t("detail.relevance", { score: slideshow.relevance_score })}
            </Badge>
            {slideshow.relevance_reason && (
              <span className="text-muted-foreground">{slideshow.relevance_reason}</span>
            )}
          </div>
        )}

        {slideshow.auto_pipeline_error && (
          <p className="rounded-md bg-destructive/10 p-2 text-destructive">
            {slideshow.auto_pipeline_error}
          </p>
        )}

        {processing && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-primary" />
            {t("detail.processing", {
              step: slideshow.auto_pipeline_step ?? "…",
            })}
          </p>
        )}

        {slideshow.source_url && (
          <a
            href={slideshow.source_url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs text-muted-foreground underline underline-offset-4"
          >
            {slideshow.source_url}
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminSlideshowDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  if (!id) return null;

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link to="/admin">{t("common.back")}</Link>
      </Button>
      <StatusHeader id={id} />
      <SlideshowEditor slideshowId={id} />
    </div>
  );
}
