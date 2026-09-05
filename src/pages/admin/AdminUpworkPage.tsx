import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Check, ChevronRight, Clapperboard, Copy, UserRoundCog, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { drapeauLangue } from "@/features/moteur/langues";
import { annulerActionUpwork, chargerUpworkDashboard } from "@/features/upwork/api";
import { Repliable } from "@/features/upwork/Deroule";
import { UPWORK_ORG_NOM } from "@/features/upwork/org";
import { nomPays } from "@/features/upwork/pipeline";
import { ICONE_KPI } from "@/features/upwork/icones";
import { totauxUpwork } from "@/features/upwork/totaux";
import type { UpworkAction } from "@/features/upwork/types";

function formatQuand(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
}

function Total({
  label,
  valeur,
  icone: Icone,
}: {
  label: string;
  valeur: string;
  icone: typeof ICONE_KPI.hm;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <Icone className="mb-2 size-4 text-muted-foreground" aria-hidden />
      <p className="font-semibold text-2xl tabular-nums">{valeur}</p>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

function CarteAction({
  action,
  locale,
  onAnnuler,
  bloque,
}: {
  action: UpworkAction;
  locale: string;
  onAnnuler: (id: string) => void;
  bloque: boolean;
}) {
  const { t } = useTranslation();
  const [copie, setCopie] = React.useState(false);

  const copier = async () => {
    await navigator.clipboard.writeText(action.prompt);
    setCopie(true);
    window.setTimeout(() => setCopie(false), 1500);
  };

  return (
    <div className="rounded-lg border bg-background p-3">
      <Repliable
        entete={
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{action.cible_nom}</span>
            <Badge variant="warning" size="sm">
              {t(`upwork.action.${action.type}`)}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {t("upwork.actionDepuis", { date: formatQuand(action.demande_at, locale) })}
            </span>
          </span>
        }
      >
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
          {action.prompt}
        </pre>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="xs" onClick={copier}>
            {copie ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copie ? t("upwork.actionCopie") : t("upwork.actionCopier")}
          </Button>
          <Button variant="ghost" size="xs" disabled={bloque} onClick={() => onAnnuler(action.id)}>
            {t("upwork.actionAnnuler")}
          </Button>
        </div>
      </Repliable>
    </div>
  );
}

export function AdminUpworkPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const dash = useQuery({
    queryKey: ["upwork-dashboard"],
    queryFn: chargerUpworkDashboard,
  });

  const annuler = useMutation({
    mutationFn: (id: string) => annulerActionUpwork(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["upwork-dashboard"] }),
  });

  const d = dash.data;
  const totaux = d ? totauxUpwork(d.missions, d.contrats) : null;
  const enAttente = (d?.actions ?? []).filter((a) => a.statut === "en_attente");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-lg tracking-tight">{t("upwork.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("upwork.subtitle", { org: UPWORK_ORG_NOM })}
        </p>
      </div>

      {dash.isPending && <p className="text-muted-foreground text-sm">{t("common.loading")}</p>}
      {dash.isError && (
        <p className="text-destructive text-sm">
          {(dash.error as Error).message || t("common.error")}
        </p>
      )}

      {d && totaux && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <p className="mb-2 font-medium text-sm">{t("upwork.syncTitre")}</p>
              <p className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                {d.sync && (
                  <Badge variant={d.sync.last_ok ? "success" : "destructive"} size="sm">
                    {d.sync.last_ok ? t("upwork.syncOk") : t("upwork.syncKo")}
                  </Badge>
                )}
                <span>
                  {d.sync?.last_run_at
                    ? t("upwork.syncQuand", {
                        date: formatQuand(d.sync.last_run_at, i18n.language),
                      })
                    : t("upwork.syncJamais")}
                </span>
              </p>
              {d.sync?.last_detail && (
                <p className="mt-1 text-muted-foreground text-xs">{d.sync.last_detail}</p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="mb-2 flex flex-wrap items-center gap-2 font-medium text-sm">
                {t("upwork.promptsTitre")}
                {enAttente.length > 0 && (
                  <Badge variant="warning" size="sm">
                    {enAttente.length}
                  </Badge>
                )}
              </p>
              {enAttente.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("upwork.promptsVide")}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs">{t("upwork.promptsAide")}</p>
                  {enAttente.map((a) => (
                    <CarteAction
                      key={a.id}
                      action={a}
                      locale={i18n.language}
                      bloque={annuler.isPending}
                      onAnnuler={(id) => annuler.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Total icone={ICONE_KPI.hm} label={t("upwork.kpiHm")} valeur={String(totaux.hms)} />
            <Total
              icone={ICONE_KPI.createurs}
              label={t("upwork.kpiCreateurs")}
              valeur={String(totaux.createurs)}
            />
            <Total
              icone={ICONE_KPI.jobHm}
              label={t("upwork.kpiJobHmOuverts")}
              valeur={String(totaux.jobsHmOuverts)}
            />
            <Total
              icone={ICONE_KPI.jobCrea}
              label={t("upwork.kpiJobCreaOuverts")}
              valeur={String(totaux.jobsCreateursOuverts)}
            />
          </div>

          {totaux.parPays.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("upwork.vide")}</p>
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
                      <p className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <UserRoundCog className="size-3.5" aria-hidden />
                          {pays.hms}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" aria-hidden />
                          {pays.createurs}
                        </span>
                      </p>
                      <p className="flex flex-wrap items-center gap-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="size-3.5" aria-hidden />
                          {pays.jobsHmOuverts}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clapperboard className="size-3.5" aria-hidden />
                          {pays.jobsCreateursOuverts}
                        </span>
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
