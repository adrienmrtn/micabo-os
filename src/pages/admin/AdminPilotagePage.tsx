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
import { supabase } from "@/lib/supabase/client";
import { listerSujets } from "@/features/moteur/api";
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Compteur label={t("pilotage.sujets")} valeur={stats.data?.sujets} />
        <Compteur label={t("pilotage.posts")} valeur={stats.data?.posts} />
        <Compteur label={t("pilotage.medias")} valeur={stats.data?.medias} />
        <Compteur label={t("pilotage.comptes")} valeur={stats.data?.comptes} />
      </div>

      {/* Le moteur tourne tout seul (crons de nuit). Pour tester à la main, tout
          est regroupé sur la page Tests — pas de boutons bruts ici. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pilotage.autoTitre")}</CardTitle>
          <CardDescription>{t("pilotage.autoDesc")}</CardDescription>
        </CardHeader>
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
          {sujets.data?.length === 0 && <EmptyState title={t("sujets.empty")} />}

          {sujets.data?.map((sujet: Sujet) => (
            <div key={sujet.id} className="space-y-1.5 rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{sujet.titre}</p>
                <div className="flex shrink-0 gap-1.5">
                  <Badge variant={badgeStatut(sujet.statut)}>{t(`statut.${sujet.statut}`)}</Badge>
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
