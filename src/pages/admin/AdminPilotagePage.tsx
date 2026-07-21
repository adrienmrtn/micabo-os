import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BarChart3, Download, Sparkles, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import {
  lancerAssignation,
  lancerExtraction,
  lancerMetriques,
  lancerPreparation,
  listerSujets,
} from "@/features/moteur/api";
import type { Sujet } from "@/features/moteur/types";

async function compter(table: string): Promise<number> {
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

function Compteur({ label, valeur }: { label: string; valeur: number | undefined }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums">{valeur ?? "—"}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function badgeStatut(statut: string) {
  if (statut === "retenu" || statut === "done") return "success";
  if (statut === "rejete" || statut === "failed") return "destructive";
  if (statut === "running") return "warning";
  return "secondary";
}

export function AdminPilotagePage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [message, setMessage] = React.useState<string | null>(null);

  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: async () => ({
      sujets: await compter("sujets"),
      posts: await compter("posts"),
      medias: await compter("media_library"),
      comptes: await compter("comptes"),
    }),
  });

  const sujets = useQuery({ queryKey: ["sujets"], queryFn: listerSujets });

  const rafraichir = () => queryClient.invalidateQueries();

  const extraction = useMutation({
    onSettled: rafraichir,
    mutationFn: () => lancerExtraction(),
    onSuccess: (r) => setMessage(t("sujets.slides", { count: r.sujetsCrees })),
  });
  const preparation = useMutation({
    onSettled: rafraichir,
    mutationFn: () => lancerPreparation(),
    onSuccess: (r) => setMessage(r.idle ? "—" : (r.etape ?? "")),
  });
  const assignation = useMutation({
    onSettled: rafraichir,
    mutationFn: () => lancerAssignation(),
    onSuccess: (r) =>
      setMessage(`${r.resultats.reduce((s, x) => s + x.crees, 0)} post(s)`),
  });

  const metriques = useMutation({
    onSettled: rafraichir,
    mutationFn: () => lancerMetriques(),
    onSuccess: (r) =>
      setMessage(`${r.resultats.reduce((s, x) => s + x.releves, 0)} relevé(s)`),
  });

  const enCours =
    extraction.isPending ||
    preparation.isPending ||
    assignation.isPending ||
    metriques.isPending;
  const echec =
    extraction.error ?? preparation.error ?? assignation.error ?? metriques.error;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Compteur label={t("pilotage.sujets")} valeur={stats.data?.sujets} />
        <Compteur label={t("pilotage.posts")} valeur={stats.data?.posts} />
        <Compteur label={t("pilotage.medias")} valeur={stats.data?.medias} />
        <Compteur label={t("pilotage.comptes")} valeur={stats.data?.comptes} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("pilotage.title")}</CardTitle>
          <CardDescription>{t("pilotage.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={enCours} onClick={() => extraction.mutate()}>
              <Download />
              {extraction.isPending ? t("pilotage.running") : t("pilotage.extraction")}
            </Button>
            <Button variant="outline" disabled={enCours} onClick={() => preparation.mutate()}>
              <Wand2 />
              {preparation.isPending ? t("pilotage.running") : t("pilotage.preparation")}
            </Button>
            <Button variant="outline" disabled={enCours} onClick={() => assignation.mutate()}>
              <Sparkles />
              {assignation.isPending ? t("pilotage.running") : t("pilotage.assignation")}
            </Button>
            <Button variant="outline" disabled={enCours} onClick={() => metriques.mutate()}>
              <BarChart3 />
              {metriques.isPending ? t("pilotage.running") : t("pilotage.metriques")}
            </Button>
          </div>

          {message && <p className="text-sm text-success">{message}</p>}
          {echec && (
            <p className="text-sm text-destructive">{(echec as Error).message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sujets.title")}</CardTitle>
          <CardDescription>{t("sujets.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sujets.isPending && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {sujets.data?.length === 0 && (
            <EmptyState title={t("sujets.empty")} />
          )}

          {sujets.data?.map((sujet: Sujet) => (
            <div key={sujet.id} className="space-y-1.5 rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{sujet.titre}</p>
                <div className="flex shrink-0 gap-1.5">
                  <Badge variant={badgeStatut(sujet.statut)}>
                    {t(`statut.${sujet.statut}`)}
                  </Badge>
                  <Badge variant={badgeStatut(sujet.preparation_statut)}>
                    {t(`statut.${sujet.preparation_statut}`)}
                  </Badge>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {[
                  t("sujets.slides", { count: sujet.structure_slides?.length ?? 0 }),
                  sujet.pertinence_score !== null
                    ? t("sujets.pertinence", { score: sujet.pertinence_score })
                    : null,
                  new Date(sujet.created_at).toLocaleDateString(i18n.language),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              {sujet.pertinence_raison && (
                <p className="text-xs text-muted-foreground">{sujet.pertinence_raison}</p>
              )}
              {sujet.preparation_erreur && (
                <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                  {sujet.preparation_erreur}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
