import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { drapeauLangue } from "@/features/moteur/langues";
import { chargerUpworkDashboard } from "@/features/upwork/api";
import { UPWORK_ORG_NOM } from "@/features/upwork/org";
import { nomPays } from "@/features/upwork/pipeline";
import { totauxUpwork } from "@/features/upwork/totaux";

function formatQuand(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}

function Total({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums">{valeur}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function AdminUpworkPage() {
  const { t, i18n } = useTranslation();

  const dash = useQuery({
    queryKey: ["upwork-dashboard"],
    queryFn: chargerUpworkDashboard,
  });

  const d = dash.data;
  const totaux = d ? totauxUpwork(d.missions, d.contrats) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{t("upwork.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("upwork.subtitle", { org: UPWORK_ORG_NOM })}</p>
      </div>

      {dash.isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {dash.isError && (
        <p className="text-sm text-destructive">
          {(dash.error as Error).message || t("common.error")}
        </p>
      )}

      {d && totaux && (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {d.sync && (
              <Badge variant={d.sync.last_ok ? "success" : "destructive"}>
                {d.sync.last_ok ? t("upwork.syncOk") : t("upwork.syncKo")}
              </Badge>
            )}
            <span>
              {d.sync?.last_run_at
                ? t("upwork.syncQuand", { date: formatQuand(d.sync.last_run_at, i18n.language) })
                : t("upwork.syncJamais")}
            </span>
            {d.sync?.last_detail && <span>· {d.sync.last_detail}</span>}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Total label={t("upwork.kpiHm")} valeur={String(totaux.hms)} />
            <Total label={t("upwork.kpiCreateurs")} valeur={String(totaux.createurs)} />
            <Total label={t("upwork.kpiJobHmOuverts")} valeur={String(totaux.jobsHmOuverts)} />
            <Total label={t("upwork.kpiJobCreaOuverts")} valeur={String(totaux.jobsCreateursOuverts)} />
          </div>

          {totaux.parPays.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("upwork.vide")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {totaux.parPays.map((pays) => (
                <Link key={pays.langue || "inconnu"} to={`/admin/upwork/${pays.langue || "xx"}`}>
                  <Card className="h-full transition-colors hover:bg-accent/40">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span aria-hidden>{pays.langue ? drapeauLangue(pays.langue) : "—"}</span>
                        {nomPays(pays.langue || null, i18n.language)}
                      </CardTitle>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <p>
                        {t("upwork.paysKpiPersonnes", { hm: pays.hms, crea: pays.createurs })}
                      </p>
                      <p className="text-muted-foreground">
                        {t("upwork.paysKpiJobs", {
                          hm: pays.jobsHmOuverts,
                          crea: pays.jobsCreateursOuverts,
                        })}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
