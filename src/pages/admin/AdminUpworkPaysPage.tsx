import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, Circle, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
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
  OBJECTIF_CREATEURS,
  etapeCouranteTimeline,
  faitsDepuisApproche,
  phase1Terminee,
  timelineCreateur,
  timelineHm,
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

function initiales(nom: string): string {
  return nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Photo({
  nom,
  url,
  taille = "md",
}: {
  nom: string;
  url: string | null;
  taille?: "sm" | "md";
}) {
  const dim = taille === "sm" ? "size-9 text-[11px]" : "size-12 text-sm";
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", dim)}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground",
        dim,
      )}
      aria-hidden
    >
      {initiales(nom) || "?"}
    </span>
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

function TimelineHorizontale({
  etapes,
  role,
}: {
  etapes: TimelineEtape[];
  role: "hm" | "createur";
}) {
  const { t } = useTranslation();
  const courante = etapeCouranteTimeline(etapes);
  return (
    <ol className="flex items-stretch gap-0 overflow-x-auto pb-1">
      {etapes.map((e, i) => {
        const ici = e.cle === courante && !e.ok;
        const label =
          e.cle === "onboarding_envoi" && role === "createur"
            ? t("upwork.timeline.onboarding_envoi_crea")
            : t(`upwork.timeline.${e.cle}`);
        return (
          <li key={e.cle} className="flex shrink-0 items-stretch">
            {i > 0 && (
              <span className="flex items-center px-0.5 text-muted-foreground" aria-hidden>
                <ChevronRight className="size-4" />
              </span>
            )}
            <div
              className={cn(
                "flex min-w-[7.5rem] max-w-[11rem] flex-col gap-0.5 rounded-md border px-2 py-1.5 text-xs",
                e.ok && "border-foreground/30 bg-background/80",
                ici && "border-foreground bg-background ring-2 ring-foreground",
                !e.ok && !ici && "border-dashed text-muted-foreground",
              )}
            >
              <span className="inline-flex items-center gap-1 font-medium">
                {e.ok ? <Check className="size-3" /> : <Circle className="size-3" />}
                {label}
              </span>
              {e.cle === "pourparlers" && e.resume && (
                <p className="line-clamp-3 text-[11px] leading-snug text-foreground">{e.resume}</p>
              )}
              {e.checks && (
                <ul className="mt-0.5 space-y-0.5 text-[11px]">
                  {e.checks.map((c) => (
                    <li key={c.cle} className="flex items-center gap-1">
                      {c.ok ? <Check className="size-2.5" /> : <Circle className="size-2.5" />}
                      {t(`upwork.timeline.check.${c.cle}`)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const PHASE = {
  1: "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40",
  2: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
  3: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
} as const;

function BandeauPhase({
  n,
  titre,
  extra,
  children,
  verrouille,
}: {
  n: 1 | 2 | 3;
  titre: string;
  extra?: string;
  children: ReactNode;
  verrouille?: boolean;
}) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-lg border p-3",
        PHASE[n],
        verrouille && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {titre}
        </h3>
        {extra && <p className="text-xs tabular-nums text-muted-foreground">{extra}</p>}
      </div>
      {children}
    </section>
  );
}

function EntetePersonne({
  a,
  taille,
}: {
  a: UpworkApproche;
  taille: "sm" | "md";
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Photo nom={a.nom} url={a.photo_url} taille={taille} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{a.nom}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={a.statut === "hired" ? "success" : "secondary"}>
            {a.statut === "hired" ? t("upwork.statutHired") : t("upwork.statutMessaged")}
          </Badge>
          <LienUpwork url={a.upwork_profile_url} label={t("upwork.lienUpwork")} />
        </div>
      </div>
    </div>
  );
}

function CartePersonne({
  a,
  role,
}: {
  a: UpworkApproche;
  role: "hm" | "createur";
}) {
  const faits = faitsDepuisApproche(a);
  const etapes = role === "createur" ? timelineCreateur(faits) : timelineHm(faits);
  return (
    <div className="space-y-2">
      <EntetePersonne a={a} taille={role === "hm" ? "md" : "sm"} />
      <TimelineHorizontale etapes={etapes} role={role} />
    </div>
  );
}

function VieHm({
  hm,
  jobCrea,
  approchesCrea,
  createursN,
}: {
  hm: UpworkApproche;
  jobCrea: UpworkMission | null;
  approchesCrea: UpworkApproche[];
  createursN: number;
}) {
  const { t } = useTranslation();
  const faits = faitsDepuisApproche(hm);
  const p1ok = phase1Terminee(faits);
  const embauches = approchesCrea.filter((a) => a.statut === "hired");
  const entretiens = approchesCrea.filter((a) => a.statut === "messaged");
  const n = Math.max(createursN, embauches.length);
  const opp = jobCrea ? opportunitesEnCours(approchesCrea, jobCrea.job_posting_id) : 0;

  return (
    <article className="space-y-3 rounded-xl border bg-card p-4">
      <EntetePersonne a={hm} taille="md" />

      <BandeauPhase n={1} titre={t("upwork.phase1")}>
        <TimelineHorizontale etapes={timelineHm(faits)} role="hm" />
      </BandeauPhase>

      <div className="grid gap-3 lg:grid-cols-2">
        <BandeauPhase
          n={2}
          titre={t("upwork.phase2")}
          extra={t("upwork.phase2Progress", { n, max: OBJECTIF_CREATEURS })}
          verrouille={!p1ok}
        >
          {!p1ok ? (
            <p className="text-sm text-muted-foreground">{t("upwork.phase2Avant")}</p>
          ) : (
            <div className="space-y-3">
              {jobCrea ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">{jobCrea.titre}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("upwork.statsPost", {
                      inv: jobCrea.invites_sent,
                      opp,
                      appl: jobCrea.applicants,
                      hired: jobCrea.hired,
                    })}
                  </p>
                  {jobCrea.job_url && (
                    <LienUpwork url={jobCrea.job_url} label={t("upwork.lienJob")} />
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("upwork.jobCreaVide")}</p>
              )}
              {embauches.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("upwork.createursVide")}</p>
              ) : (
                embauches.map((a) => <CartePersonne key={a.id} a={a} role="createur" />)
              )}
            </div>
          )}
        </BandeauPhase>

        <BandeauPhase n={3} titre={t("upwork.phase3")} verrouille={!p1ok}>
          {!p1ok ? (
            <p className="text-sm text-muted-foreground">{t("upwork.phase3Avant")}</p>
          ) : entretiens.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("upwork.entretienVide")}</p>
          ) : (
            <div className="space-y-3">
              {entretiens.map((a) => <CartePersonne key={a.id} a={a} role="createur" />)}
            </div>
          )}
        </BandeauPhase>
      </div>
    </article>
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
  const hms = jobsHm
    .flatMap((j) => approchesDuJob(approches, j.job_posting_id))
    .filter((a) => a.role === "hm");

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

          {hms.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("upwork.approcheVide")}</p>
          ) : (
            <div className="space-y-4">
              {hms.map((hm) => {
                const jobCrea =
                  jobsCrea.find((j) => j.job_posting_id === hm.job_createur_id) ??
                  (hm.statut === "hired" ? jobsCrea[0] ?? null : null);
                const approchesCrea = jobCrea
                  ? approchesDuJob(approches, jobCrea.job_posting_id)
                  : [];
                const contrat = (d.contrats ?? []).find(
                  (c) => c.contract_id && c.contract_id === hm.contract_id,
                );
                return (
                  <VieHm
                    key={hm.id}
                    hm={hm}
                    jobCrea={hm.job_createur_id || hm.statut === "hired" ? jobCrea : null}
                    approchesCrea={
                      hm.job_createur_id || hm.statut === "hired" ? approchesCrea : []
                    }
                    createursN={contrat?.createurs_n ?? 0}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
