import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import { listerMedias, listerSources } from "@/features/moteur/api";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-64";

export function AdminBibliothequePage() {
  const { t } = useTranslation();
  const [sourceId, setSourceId] = React.useState("");

  const sources = useQuery({ queryKey: ["sources"], queryFn: listerSources });
  const medias = useQuery({
    queryKey: ["medias", sourceId || "tous"],
    queryFn: () => listerMedias(sourceId || undefined),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("bibliotheque.title")}</CardTitle>
        <CardDescription>{t("bibliotheque.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <select
          aria-label={t("comptes.source")}
          className={selectClass}
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
        >
          <option value="">{t("bibliotheque.toutes")}</option>
          {sources.data?.map((s) => (
            <option key={s.id} value={s.id}>
              @{s.handle_tiktok}
            </option>
          ))}
        </select>

        {medias.isPending && (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        )}
        {medias.data?.length === 0 && <EmptyState title={t("bibliotheque.empty")} />}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {medias.data?.map((media) => (
            <div key={media.id} className="space-y-1.5">
              <img
                src={media.url}
                alt=""
                className="aspect-[3/4] w-full rounded-md border object-cover"
              />
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">{t(`bibliotheque.source.${media.source}`)}</Badge>
                {media.visage_identifiable ? (
                  <Badge variant="warning">{t("bibliotheque.visage")}</Badge>
                ) : (
                  <Badge variant="success">{t("bibliotheque.sansVisage")}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
