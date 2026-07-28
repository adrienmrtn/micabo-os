import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from "@/components/ui/card";
import { LabelEditor } from "@/features/moteur/LabelPicker";
import { listerContenus, setLabelsContenu, labelsDuContenu } from "@/features/moteur/api";
import { nomLangue } from "@/features/moteur/langues";

export function AdminContenusPage() {
  const { t } = useTranslation();
  const [filtre, setFiltre] = React.useState<"tous" | "valide" | "brouillon" | "rejete">("valide");

  const contenus = useQuery({
    queryKey: ["contenus", filtre],
    queryFn: () =>
      listerContenus({
        statut: filtre === "tous" ? undefined : filtre,
        limit: 100,
      }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("contenus.title")}</CardTitle>
          <CardDescription>{t("contenus.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["valide", "brouillon", "rejete", "tous"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltre(f)}
                className={
                  filtre === f
                    ? "rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                    : "rounded-md border px-3 py-1 text-xs"
                }
              >
                {t(`contenus.filtre.${f}`)}
              </button>
            ))}
          </div>

          {contenus.isPending && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {!contenus.isPending && (contenus.data?.length ?? 0) === 0 && (
            <EmptyState title={t("contenus.empty")} />
          )}

          <div className="space-y-3">
            {(contenus.data ?? []).map((c) => (
              <div key={c.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{c.titre || t("contenus.sansTitre")}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.langue_source.toUpperCase()}
                      {c.parent_id ? ` · ${t("contenus.variation")}` : ""}
                      {c.profondeur > 0 ? ` · d${c.profondeur}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      c.statut === "valide"
                        ? "success"
                        : c.statut === "rejete"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {c.statut}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(c.scores ?? [])
                    .slice()
                    .sort((a, b) => b.score - a.score)
                    .map((s) => (
                      <span
                        key={s.langue}
                        className="rounded border px-1.5 py-0.5 text-[11px] tabular-nums"
                        title={`${s.nb_passages} passages`}
                      >
                        {nomLangue(s.langue)} {s.score.toFixed(0)}
                      </span>
                    ))}
                </div>

                <LabelEditor
                  queryKey={["contenu-labels", c.id]}
                  load={() => labelsDuContenu(c.id)}
                  save={(ids) => setLabelsContenu(c.id, ids)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
