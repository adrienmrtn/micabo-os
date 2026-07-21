import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import {
  creerSource,
  lancerExtraction,
  listerSources,
  majSource,
  supprimerSource,
} from "@/features/moteur/api";

function BoutonExtraire({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [resultat, setResultat] = React.useState<string | null>(null);

  const extraire = useMutation({
    mutationFn: () => lancerExtraction(sourceId),
    onSuccess: (r) => {
      setResultat(t("sujets.slides", { count: r.sujetsCrees }));
      queryClient.invalidateQueries();
    },
    onError: (e) => setResultat((e as Error).message),
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={extraire.isPending} onClick={() => extraire.mutate()}>
        {extraire.isPending ? t("sources.extraction") : t("sources.extraire")}
      </Button>
      {resultat && <span className="text-xs text-muted-foreground">{resultat}</span>}
    </div>
  );
}

export function AdminSourcesPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const sources = useQuery({ queryKey: ["sources"], queryFn: listerSources });

  const [handle, setHandle] = React.useState("");
  const [niche, setNiche] = React.useState("");

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["sources"] });
  const ajouter = useMutation({
    mutationFn: () => creerSource({ handle, niche, langue: "fr" }),
    onSuccess: () => {
      setHandle("");
      setNiche("");
      rafraichir();
    },
  });
  const basculer = useMutation({
    mutationFn: (input: { id: string; actif: boolean }) =>
      majSource(input.id, { is_active: input.actif }),
    onSuccess: rafraichir,
  });
  const retirer = useMutation({ mutationFn: supprimerSource, onSuccess: rafraichir });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sources.title")}</CardTitle>
        <CardDescription>{t("sources.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (handle.trim()) ajouter.mutate();
          }}
          className="grid gap-4 sm:grid-cols-3"
        >
          <div className="space-y-2">
            <Label htmlFor="handle">{t("sources.handle")}</Label>
            <Input
              id="handle"
              required
              placeholder="@mon_compte"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="niche">{t("sources.niche")}</Label>
            <Input id="niche" value={niche} onChange={(e) => setNiche(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={ajouter.isPending}>
              {ajouter.isPending ? t("common.saving") : t("sources.add")}
            </Button>
          </div>
          {ajouter.isError && (
            <p className="text-sm text-destructive sm:col-span-3">
              {(ajouter.error as Error).message}
            </p>
          )}
        </form>

        <div className="space-y-2">
          {sources.isPending && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {sources.data?.length === 0 && <EmptyState title={t("sources.empty")} />}

          {sources.data?.map((source) => (
            <div
              key={source.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">@{source.handle_tiktok}</span>
                  {!source.is_active && (
                    <Badge variant="secondary">{t("sources.inactive")}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {[
                    source.niche,
                    source.dernier_scrape_at
                      ? t("sources.extraitLe", {
                          date: new Date(source.dernier_scrape_at).toLocaleDateString(
                            i18n.language,
                          ),
                        })
                      : t("sources.jamais"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div className="flex items-start gap-2">
                <BoutonExtraire sourceId={source.id} />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    basculer.mutate({ id: source.id, actif: !source.is_active })
                  }
                >
                  {source.is_active ? t("sources.deactivate") : t("sources.activate")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (window.confirm(t("sources.confirmDelete"))) retirer.mutate(source.id);
                  }}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
