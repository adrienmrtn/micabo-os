import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Circle, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { drapeauLangue } from "@/features/moteur/langues";
import { chargerUpworkDashboard } from "@/features/upwork/api";
import { nomPays } from "@/features/upwork/pipeline";
import {
  approchesDuJob,
  langueCle,
  missionOuverte,
  opportunitesEnCours,
  totauxUpwork,
} from "@/features/upwork/totaux";
import {
  etapeCouranteTimeline,
  faitsDepuisApproche,
  timelinePour,
  type TimelineEtape,
} from "@/features/upwork/timeline";
import type { UpworkApproche, UpworkMission } from "@/features/upwork/types";
import { cn } from "@/lib/utils";

function Total({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums">{valeur}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function LienUpwork({ url, label }: { url: string | null; label: string }) {
  if (!url) return <span className="text-sm text-muted-foreground">{label}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}

function Timeline({ etapes, role }: { etapes: TimelineEtape[]; role: "hm" | "createur" }) {
  const { t } = useTranslation();
  const courante = etapeCouranteTimeline(etapes);
  return (
    <ol className="space-y-2">
      {etapes.map((e) => {
        const ici = e.cle === courante && !e.ok;
        const label =
          e.cle === "onboarding_envoi" && role === "createur"
            ? t("upwork.timeline.onboarding_envoi_crea")
            : t(`upwork.timeline.${e.cle}`);
        return (
          <li
            key={e.cle}
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              e.ok && "border-foreground/30 bg-background",
              ici && "border-foreground ring-2 ring-foreground",
              !e.ok && !ici && "border-dashed text-muted-foreground",
            )}
          >
            <p className="inline-flex items-center gap-1.5 font-medium">
              {e.ok ? <Check className="size-3.5" /> : <Circle className="size-3.5" />}
              {label}
            </p>
            {e.cle === "pourparlers" && e.resume && (
              <p className="mt-1 text-sm text-foreground">{e.resume}</p>
            )}
            {e.checks && (
              <ul className="mt-1.5 space-y-0.5 text-xs">
                {e.checks.map((c) => (
                  <li key={c.cle} className="flex items-center gap-1.5">
                    {c.ok ? <Check className="size-3" /> : <Circle className="size-3" />}
                    {t(`upwork.timeline.check.${c.cle}`)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CarteApproche({ a }: { a: UpworkApproche }) {
  const { t } = useTranslation();
  const faits = faitsDepuisApproche(a);
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">{a.nom}</p>
        <Badge variant={a.statut === "hired" ? "success" : "secondary"}>
          {a.statut === "hired" ? t("upwork.statutHired") : t("upwork.statutMessaged")}
        </Badge>
        <LienUpwork url={a.upwork_profile_url} label={t("upwork.lienUpwork")} />
      </div>
      <Timeline etapes={timelinePour(faits)} role={a.role} />
    </div>
  );
}

function BlocJob({
  m,
  approches,
}: {
  m: UpworkMission;
  approches: UpworkApproche[];
}) {
  const { t } = useTranslation();
  const personnes = approchesDuJob(approches, m.job_posting_id);
  const opp = opportunitesEnCours(approches, m.job_posting_id);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{m.titre}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("upwork.statsPost", {
            inv: m.invites_sent,
            opp,
            appl: m.applicants,
            hired: m.hired,
          })}
        </p>
        {m.job_url && <LienUpwork url={m.job_url} label={t("upwork.lienJob")} />}
      </CardHeader>
      <CardContent className="space-y-3">
        {personnes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("upwork.approcheVide")}</p>
        ) : (
          personnes.map((a) => <CarteApproche key={a.id} a={a} />)
        )}
      </CardContent>
    </Card>
  );
}

export function AdminUpworkPaysPage() {
  const { t, i18n } = useTranslation();
  const { langue: raw } = useParams();
  const langue = (raw ?? "").toLowerCase();

  const dash = useQuery({
    queryKey: ["upwork-dashboard"],
    queryFn: chargerUpworkDashboard,
  });

  if (!/^[a-z]{2}$/.test(langue)) {
    return <Navigate to="/admin/upwork" replace />;
  }

  const d = dash.data;
  const totaux = d ? totauxUpwork(d.missions, d.contrats) : null;
  const pays = totaux?.parPays.find((p) => p.langue === langue);
  const jobs = (d?.missions ?? []).filter(
    (m) => missionOuverte(m.statut) && langueCle(m.langue) === langue,
  );
  const jobsHm = jobs.filter((m) => m.famille === "hm");
  const jobsCrea = jobs.filter((m) => m.famille === "createur");
  const approches = d?.approches ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/upwork"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("upwork.retourDash")}
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span aria-hidden>{drapeauLangue(langue)}</span>
          {nomPays(langue, i18n.language)}
        </h1>
      </div>

      {dash.isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {dash.isError && (
        <p className="text-sm text-destructive">
          {(dash.error as Error).message || t("common.error")}
        </p>
      )}

      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Total label={t("upwork.kpiHm")} valeur={String(pays?.hms ?? 0)} />
            <Total label={t("upwork.kpiCreateurs")} valeur={String(pays?.createurs ?? 0)} />
            <Total label={t("upwork.kpiJobHmOuverts")} valeur={String(pays?.jobsHmOuverts ?? 0)} />
            <Total
              label={t("upwork.kpiJobCreaOuverts")}
              valeur={String(pays?.jobsCreateursOuverts ?? 0)}
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("upwork.sectionJobHm")}
            </h2>
            {jobsHm.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("upwork.jobHmVide")}</p>
            ) : (
              jobsHm.map((m) => <BlocJob key={m.id} m={m} approches={approches} />)
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("upwork.sectionJobCrea")}
            </h2>
            {jobsCrea.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("upwork.jobCreaVide")}</p>
            ) : (
              jobsCrea.map((m) => <BlocJob key={m.id} m={m} approches={approches} />)
            )}
          </section>
        </>
      )}
    </div>
  );
}
