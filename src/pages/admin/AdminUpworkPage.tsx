import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Circle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import { drapeauLangue, nomLangue } from "@/features/moteur/langues";
import { chargerUpworkDashboard } from "@/features/upwork/api";
import { UPWORK_ORG_NOM } from "@/features/upwork/org";
import {
  etapeCourante,
  formatDureeHeures,
  pipelineHm,
  pipelineMission,
  redigerBriefHm,
  redigerBriefMission,
  type EtapePipeline,
  type FaitsHm,
} from "@/features/upwork/pipeline";
import { missionsFiltrees, totauxUpwork } from "@/features/upwork/totaux";
import type { FamilleMission, UpworkContrat, UpworkMission } from "@/features/upwork/types";
import { cn } from "@/lib/utils";

type FiltreFamille = FamilleMission | "toutes";

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

function FiltreChip({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs",
        actif ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted/40",
      )}
    >
      {children}
    </button>
  );
}

function Drapeau({ langue }: { langue: string | null }) {
  if (!langue) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span aria-hidden>{drapeauLangue(langue)}</span>
      <span>{nomLangue(langue)}</span>
    </span>
  );
}

function Pipeline({ etapes, locale }: { etapes: EtapePipeline[]; locale: string }) {
  const { t } = useTranslation();
  return (
    <ol className="flex flex-wrap gap-2">
      {etapes.map((e) => (
        <li
          key={e.cle}
          className={cn(
            "flex min-w-[7.5rem] flex-col gap-0.5 rounded-md border px-2 py-1.5 text-xs",
            e.fait ? "border-foreground/30 bg-muted/40" : "border-dashed text-muted-foreground",
          )}
        >
          <span className="inline-flex items-center gap-1 font-medium">
            {e.fait ? <Check className="size-3" /> : <Circle className="size-3" />}
            {t(`upwork.etape.${e.cle}`)}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {e.at ? formatQuand(e.at, locale) : e.fait ? t("upwork.etapeFait") : t("upwork.etapeVide")}
          </span>
          {e.heuresDepuisPrev != null && (
            <span className="text-muted-foreground">
              +{formatDureeHeures(e.heuresDepuisPrev, locale)}
            </span>
          )}
          {e.detail && e.cle !== "slack" && e.detail !== "0" && (
            <span className="text-muted-foreground">{e.detail}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

function faitsMission(m: UpworkMission) {
  return {
    created_time: m.created_time,
    applicants: m.applicants,
    invites_sent: m.invites_sent,
    messaged: m.messaged,
    hired: m.hired,
    langue: m.langue,
    famille: m.famille,
  };
}

function faitsHm(c: UpworkContrat, mission: UpworkMission | undefined) {
  return {
    nom: c.freelancer_nom || "—",
    langue: c.langue ?? mission?.langue ?? null,
    job_poste_at: mission?.created_time ?? null,
    invites_sent: mission?.invites_sent ?? 0,
    messaged: mission?.messaged ?? 0,
    contrat_at: c.contrat_at ?? (c.start_date ? `${c.start_date}T00:00:00Z` : null),
    slack_ok: c.slack_ok,
    slack_at: c.slack_at,
    codes_at: c.codes_at,
    os_connecte_at: c.os_connecte_at,
    createurs_n: c.createurs_n,
  };
}

function faitsHmDepuisMission(m: UpworkMission, c?: UpworkContrat): FaitsHm {
  if (c) return faitsHm(c, m);
  return {
    nom: "—",
    langue: m.langue,
    job_poste_at: m.created_time,
    invites_sent: m.invites_sent,
    messaged: m.messaged,
    contrat_at: null,
    slack_ok: false,
    slack_at: null,
    codes_at: null,
    os_connecte_at: null,
    createurs_n: 0,
  };
}

function CarteMission({ m, contrat }: { m: UpworkMission; contrat?: UpworkContrat }) {
  const { t, i18n } = useTranslation();
  const faits = faitsMission(m);
  const etapes =
    m.famille === "hm" ? pipelineHm(faitsHmDepuisMission(m, contrat)) : pipelineMission(faits);
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{m.titre}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Drapeau langue={m.langue} />
            <Badge variant="outline">{t(`upwork.famille.${m.famille}`)}</Badge>
            {contrat?.freelancer_nom && (
              <span className="text-xs text-muted-foreground">{contrat.freelancer_nom}</span>
            )}
          </div>
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {t("upwork.faitsMission", {
            appl: m.applicants,
            inv: m.invites_sent,
            msg: m.messaged,
            hired: m.hired,
          })}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{redigerBriefMission(faits, i18n.language)}</p>
      <Pipeline etapes={etapes} locale={i18n.language} />
    </div>
  );
}

function CarteHm({ c, mission }: { c: UpworkContrat; mission?: UpworkMission }) {
  const { t, i18n } = useTranslation();
  const faits = faitsHm(c, mission);
  const etapes = pipelineHm(faits);
  const prochaine = etapeCourante(etapes);
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{c.freelancer_nom || t("upwork.sansNom")}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Drapeau langue={faits.langue} />
            <Badge variant={c.slack_ok ? "success" : "warning"}>
              {c.slack_ok ? t("upwork.slackOk") : t("upwork.slackKo")}
            </Badge>
            <Badge variant={c.os_connecte_at ? "success" : "warning"}>
              {c.os_connecte_at ? t("upwork.osOk") : t("upwork.osKo")}
            </Badge>
            <Badge variant="outline">
              {t("upwork.prochaine")} : {t(`upwork.etape.${prochaine}`)}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("upwork.nbCreateursHm", { n: c.createurs_n })}
        </p>
      </div>
      <p className="text-sm leading-relaxed">{redigerBriefHm(faits, i18n.language)}</p>
      <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t("upwork.etape.job")}</dt>
          <dd className="tabular-nums">{formatQuand(faits.job_poste_at, i18n.language)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("upwork.etape.invites")}</dt>
          <dd className="tabular-nums">{faits.invites_sent}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("upwork.etape.questions")}</dt>
          <dd className="tabular-nums">{faits.messaged}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("upwork.etape.contrat")}</dt>
          <dd className="tabular-nums">{formatQuand(faits.contrat_at, i18n.language)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("upwork.etape.slack")}</dt>
          <dd>{c.slack_ok ? (c.slack_user_id ?? t("upwork.etapeFait")) : t("upwork.etapeVide")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("upwork.etape.codes")}</dt>
          <dd className="tabular-nums">{formatQuand(faits.codes_at, i18n.language)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("upwork.etape.os")}</dt>
          <dd className="tabular-nums">{formatQuand(faits.os_connecte_at, i18n.language)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("upwork.famille.createur")}</dt>
          <dd className="tabular-nums">{c.createurs_n}</dd>
        </div>
      </dl>
      <Pipeline etapes={etapes} locale={i18n.language} />
    </div>
  );
}

export function AdminUpworkPage() {
  const { t, i18n } = useTranslation();
  const [famille, setFamille] = React.useState<FiltreFamille>("toutes");

  const dash = useQuery({
    queryKey: ["upwork-dashboard"],
    queryFn: chargerUpworkDashboard,
  });

  const d = dash.data;
  const totaux = d ? totauxUpwork(d.missions, d.contrats, d.alertes) : null;
  const missions = d ? missionsFiltrees(d.missions, famille) : [];
  const missionParJob = new Map((d?.missions ?? []).map((m) => [m.job_posting_id, m]));
  const contratParJob = new Map(
    (d?.contrats ?? []).filter((c) => c.job_posting_id).map((c) => [c.job_posting_id as string, c]),
  );
  const alertesL2 = (d?.alertes ?? []).filter((a) => a.niveau === "l2");
  const alertesL1 = (d?.alertes ?? []).filter((a) => a.niveau === "l1");

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
          <Card>
            <CardHeader>
              <CardTitle>{t("upwork.syncTitre")}</CardTitle>
              <CardDescription>
                {d.sync?.last_run_at
                  ? t("upwork.syncQuand", { date: formatQuand(d.sync.last_run_at, i18n.language) })
                  : t("upwork.syncJamais")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2 text-sm">
              {d.sync && (
                <Badge variant={d.sync.last_ok ? "success" : "destructive"}>
                  {d.sync.last_ok ? t("upwork.syncOk") : t("upwork.syncKo")}
                </Badge>
              )}
              {d.sync?.last_detail && (
                <span className="text-muted-foreground">{d.sync.last_detail}</span>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Total label={t("upwork.kpiOuvertes")} valeur={String(totaux.missionsOuvertes)} />
            <Total label={t("upwork.kpiHm")} valeur={String(totaux.missionsHmOuvertes)} />
            <Total label={t("upwork.kpiNew")} valeur={String(totaux.newApplicants)} />
            <Total label={t("upwork.kpiContrats")} valeur={String(totaux.contratsActifs)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("upwork.missionsTitre")}</CardTitle>
              <CardDescription>{t("upwork.missionsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(["toutes", "hm", "createur"] as const).map((f) => (
                  <FiltreChip key={f} actif={famille === f} onClick={() => setFamille(f)}>
                    {t(`upwork.famille.${f}`)}
                  </FiltreChip>
                ))}
              </div>
              {missions.length === 0 ? (
                <EmptyState title={t("upwork.vide")} />
              ) : (
                <div className="space-y-3">
                  {missions.map((m) => (
                    <CarteMission key={m.id} m={m} contrat={contratParJob.get(m.job_posting_id)} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("upwork.contratsTitre")}</CardTitle>
              <CardDescription>{t("upwork.contratsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {d.contrats.length === 0 ? (
                <EmptyState title={t("upwork.vide")} />
              ) : (
                <div className="space-y-3">
                  {d.contrats.map((c) => (
                    <CarteHm
                      key={c.id}
                      c={c}
                      mission={c.job_posting_id ? missionParJob.get(c.job_posting_id) : undefined}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("upwork.alertesTitre")}</CardTitle>
              <CardDescription>{t("upwork.alertesDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {d.alertes.length === 0 ? (
                <EmptyState title={t("upwork.videAlertes")} />
              ) : (
                <>
                  {alertesL2.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{t("upwork.l2")}</p>
                      {alertesL2.map((a) => (
                        <div
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm"
                        >
                          <span className="truncate">
                            {a.nom}
                            {a.handle ? (
                              <span className="ml-1.5 text-xs text-muted-foreground">@{a.handle}</span>
                            ) : null}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">
                              {t("upwork.jours", { n: a.jours_sans_post })}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {a.manager_nom || t("upwork.sansHm")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {alertesL1.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{t("upwork.l1")}</p>
                      {alertesL1.map((a) => (
                        <div
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm"
                        >
                          <span className="truncate">{a.nom}</span>
                          <span className="text-xs text-muted-foreground">
                            {a.manager_nom || t("upwork.sansHm")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
