import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, Circle, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { drapeauLangue } from "@/features/moteur/langues";
import { chargerUpworkDashboard } from "@/features/upwork/api";
import {
  titreMetierHm,
  titreMetierJobCreateur,
  titreMetierJobHm,
  marchesDepuisDashboard,
} from "@/features/upwork/marche";
import { UPWORK_ORG_NOM } from "@/features/upwork/org";
import {
  etapeCourante,
  formatDureeHeures,
  nomPays,
  pipelineHm,
  pipelineJob,
  redigerBriefHm,
  redigerBriefMission,
  type EtapePipeline,
} from "@/features/upwork/pipeline";
import { totauxUpwork } from "@/features/upwork/totaux";
import type { UpworkAlerte, UpworkContrat, UpworkMission } from "@/features/upwork/types";
import { cn } from "@/lib/utils";

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

function LabelObjet({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
      {children}
    </span>
  );
}

function Pipeline({
  etapes,
  locale,
  chemin,
}: {
  etapes: EtapePipeline[];
  locale: string;
  chemin: string;
}) {
  const { t } = useTranslation();
  const courante = etapeCourante(etapes);
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground">{chemin}</p>
      <ol className="flex items-stretch gap-0 overflow-x-auto pb-0.5">
        {etapes.map((e, i) => {
          const ici = e.cle === courante && !e.fait;
          return (
            <li key={e.cle} className="flex shrink-0 items-stretch">
              {i > 0 && (
                <span className="flex items-center px-0.5 text-muted-foreground" aria-hidden>
                  <ChevronRight className="size-4" />
                </span>
              )}
              <div
                className={cn(
                  "flex min-w-[5.75rem] flex-col gap-0.5 rounded-md border px-2 py-1.5 text-xs",
                  e.fait && "border-foreground/40 bg-background",
                  ici && "border-foreground bg-background ring-2 ring-foreground",
                  !e.fait && !ici && "border-dashed text-muted-foreground",
                )}
              >
                <span className="inline-flex items-center gap-1 font-medium">
                  {e.fait ? <Check className="size-3" /> : <Circle className="size-3" />}
                  {t(`upwork.etape.${e.cle}`)}
                </span>
                <span className={cn("tabular-nums", !e.fait && "text-muted-foreground")}>
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
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function LienUpwork({ url, titre }: { url: string | null; titre: string }) {
  if (!url) {
    return <p className="text-[11px] text-muted-foreground">{titre}</p>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
    >
      {titre}
      <ExternalLink className="size-3" />
    </a>
  );
}

function faitsJob(m: UpworkMission) {
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

function faitsPersonneHm(c: UpworkContrat, job: UpworkMission | null) {
  return {
    nom: c.freelancer_nom || "—",
    langue: c.langue ?? job?.langue ?? null,
    job_poste_at: job?.created_time ?? null,
    invites_sent: job?.invites_sent ?? 0,
    messaged: job?.messaged ?? 0,
    contrat_at: c.contrat_at ?? (c.start_date ? `${c.start_date}T00:00:00Z` : null),
    slack_ok: c.slack_ok,
    slack_at: c.slack_at,
    codes_at: c.codes_at,
    os_connecte_at: c.os_connecte_at,
    createurs_n: c.createurs_n,
  };
}

function Bloc({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function CarteJob({ m }: { m: UpworkMission }) {
  const { t, i18n } = useTranslation();
  const faits = faitsJob(m);
  const titre =
    m.famille === "hm"
      ? titreMetierJobHm(m.langue ?? "", i18n.language)
      : titreMetierJobCreateur(m.langue ?? "", i18n.language);
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <LabelObjet>{m.famille === "hm" ? t("upwork.objet.jobHm") : t("upwork.objet.jobCreateur")}</LabelObjet>
        <p className="text-sm font-semibold">{titre}</p>
      </div>
      <LienUpwork url={m.job_url} titre={m.titre} />
      <p className="text-sm">{redigerBriefMission(faits, i18n.language)}</p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {t("upwork.faitsMission", {
          appl: m.applicants,
          inv: m.invites_sent,
          msg: m.messaged,
          hired: m.hired,
        })}
      </p>
      <Pipeline
        etapes={pipelineJob(faits)}
        locale={i18n.language}
        chemin={t("upwork.pipelineCheminJob")}
      />
    </div>
  );
}

function LigneJobPourvu({ m, nom }: { m: UpworkMission; nom: string | null }) {
  const { t } = useTranslation();
  return (
    <p className="text-sm text-muted-foreground">
      {t("upwork.jobHmPourvu", {
        nom: nom || t("upwork.sansNom"),
        appl: m.applicants,
        inv: m.invites_sent,
      })}{" "}
      {m.job_url ? (
        <a
          href={m.job_url}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:underline"
        >
          {m.titre}
        </a>
      ) : (
        <span>{m.titre}</span>
      )}
    </p>
  );
}

function CarteHm({ c, job }: { c: UpworkContrat; job: UpworkMission | null }) {
  const { t, i18n } = useTranslation();
  const faits = faitsPersonneHm(c, job);
  const etapes = pipelineHm(faits);
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <LabelObjet>{t("upwork.objet.hm")}</LabelObjet>
        <p className="text-sm font-semibold">
          {titreMetierHm(c.freelancer_nom || t("upwork.sansNom"), faits.langue ?? "", i18n.language)}
        </p>
        <Badge variant={c.slack_ok ? "success" : "warning"}>
          {c.slack_ok ? t("upwork.slackOk") : t("upwork.slackKo")}
        </Badge>
        <Badge variant={c.os_connecte_at ? "success" : "warning"}>
          {c.os_connecte_at ? t("upwork.osOk") : t("upwork.osKo")}
        </Badge>
      </div>
      <p className="text-sm">{redigerBriefHm(faits, i18n.language)}</p>
      <Pipeline etapes={etapes} locale={i18n.language} chemin={t("upwork.pipelineCheminHm")} />
    </div>
  );
}

function LigneCreateur({ a }: { a: UpworkAlerte }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm">
      <span className="truncate">
        {a.nom || t("upwork.sansNom")}
        {a.handle ? <span className="ml-1.5 text-xs text-muted-foreground">@{a.handle}</span> : null}
      </span>
      <Badge variant={a.niveau === "l2" ? "destructive" : "warning"}>
        {t("upwork.jours", { n: a.jours_sans_post })}
      </Badge>
    </div>
  );
}

function Vide({ texte }: { texte: string }) {
  return <p className="text-sm text-muted-foreground">{texte}</p>;
}

export function AdminUpworkPage() {
  const { t, i18n } = useTranslation();

  const dash = useQuery({
    queryKey: ["upwork-dashboard"],
    queryFn: chargerUpworkDashboard,
  });

  const d = dash.data;
  const totaux = d ? totauxUpwork(d.missions, d.contrats, d.alertes) : null;
  const marches = d ? marchesDepuisDashboard(d.missions, d.contrats, d.alertes) : [];

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
            <Total label={t("upwork.kpiJobHm")} valeur={String(totaux.jobsHmOuverts)} />
            <Total label={t("upwork.kpiHmPoste")} valeur={String(totaux.hmEnPoste)} />
            <Total label={t("upwork.kpiJobCrea")} valeur={String(totaux.jobsCreateursOuverts)} />
            <Total label={t("upwork.kpiCreaRetard")} valeur={String(totaux.createursEnRetard)} />
          </div>

          {marches.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("upwork.vide")}</p>
          ) : (
            marches.map((marche) => {
              const pays = nomPays(marche.langue || null, i18n.language);
              const jobHmPourvu = Boolean(marche.jobHm && marche.jobHm.hired > 0 && marche.hm);
              return (
                <Card key={marche.langue || "inconnu"}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span aria-hidden>{marche.langue ? drapeauLangue(marche.langue) : "—"}</span>
                      {pays}
                    </CardTitle>
                    <CardDescription>{t("upwork.marcheDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <Bloc label={t("upwork.objet.hm")}>
                      {marche.hm ? (
                        <CarteHm c={marche.hm} job={marche.jobHm} />
                      ) : (
                        <Vide texte={t("upwork.hmVide")} />
                      )}
                    </Bloc>

                    <Bloc label={t("upwork.objet.jobHm")}>
                      {!marche.jobHm ? (
                        <Vide texte={t("upwork.jobHmVide")} />
                      ) : jobHmPourvu ? (
                        <LigneJobPourvu m={marche.jobHm} nom={marche.hm?.freelancer_nom ?? null} />
                      ) : (
                        <CarteJob m={marche.jobHm} />
                      )}
                    </Bloc>

                    <Bloc label={t("upwork.objet.jobCreateur")}>
                      {marche.jobsCreateurs.length === 0 ? (
                        <Vide
                          texte={
                            marche.hm ? t("upwork.jobCreaVide") : t("upwork.jobCreaAvantHm")
                          }
                        />
                      ) : (
                        <div className="space-y-2">
                          {marche.jobsCreateurs.map((j) => (
                            <CarteJob key={j.id} m={j} />
                          ))}
                        </div>
                      )}
                    </Bloc>

                    <Bloc label={t("upwork.objet.createur")}>
                      {marche.createurs.length === 0 ? (
                        <Vide
                          texte={
                            (marche.hm?.createurs_n ?? 0) > 0
                              ? t("upwork.createursOk", { n: marche.hm!.createurs_n })
                              : t("upwork.createursVide")
                          }
                        />
                      ) : (
                        <div className="space-y-1.5">
                          {marche.createurs.map((a) => (
                            <LigneCreateur key={a.id} a={a} />
                          ))}
                        </div>
                      )}
                    </Bloc>
                  </CardContent>
                </Card>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
