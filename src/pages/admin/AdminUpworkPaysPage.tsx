import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, ExternalLink, OctagonX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { drapeauLangue } from "@/features/moteur/langues";
import {
  annulerActionUpwork,
  arreterCampagneHm,
  chargerUpworkDashboard,
  creerActionUpwork,
  deciderCandidat,
  lancerCampagneHm,
  marquerAjoutUpwork,
} from "@/features/upwork/api";
import { campagneDuPays, candidatsDeCampagne } from "@/features/upwork/campagne";
import { Deroule, Jauge, Repliable, ResumeEtape } from "@/features/upwork/Deroule";
import { JobsHm } from "@/features/upwork/JobsHm";
import { nomPays } from "@/features/upwork/pipeline";
import {
  approchesDuJob,
  jobCreateurPourHm,
  langueCle,
  missionOuverte,
  opportunitesEnCours,
  totauxUpwork,
} from "@/features/upwork/totaux";
import { ICONE_KPI } from "@/features/upwork/icones";
import {
  OBJECTIF_CREATEURS,
  avancement,
  faitsDepuisApproche,
  phase1Terminee,
  timelineCreateur,
  timelineHm,
} from "@/features/upwork/timeline";
import type { UpworkAction, UpworkApproche, UpworkMission } from "@/features/upwork/types";
import { cn } from "@/lib/utils";

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
  const dim = taille === "sm" ? "size-8 text-[11px]" : "size-10 text-xs";
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
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}

/** Entête compacte : c'est ce qu'on voit avant de déplier. */
function EntetePersonne({
  a,
  etapes,
  taille,
}: {
  a: UpworkApproche;
  etapes: ReturnType<typeof timelineHm>;
  taille: "sm" | "md";
}) {
  const { t } = useTranslation();
  const { faites, total } = avancement(etapes);
  return (
    <span className="flex items-center gap-3">
      <Photo nom={a.nom} url={a.photo_url} taille={taille} />
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("font-semibold", taille === "md" ? "text-sm" : "text-sm")}>
            {a.nom}
          </span>
          <Badge variant={a.statut === "hired" ? "success" : "secondary"} size="sm">
            {a.statut === "hired" ? t("upwork.statutHired") : t("upwork.statutMessaged")}
          </Badge>
        </span>
        <ResumeEtape etapes={etapes} />
        <Jauge faites={faites} total={total} />
      </span>
    </span>
  );
}

/** Une seule case se coche à la main : le reste vient de l'OS, Slack ou Upwork. */
function CocheAdmin({
  ok,
  disabled,
  onChange,
}: {
  ok: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="mt-3 flex items-start gap-3 rounded-lg border border-dashed p-3">
      <Switch checked={ok} disabled={disabled} onCheckedChange={onChange} />
      <span className="min-w-0">
        <span className="block font-medium text-sm">{t("upwork.timeline.check.upwork")}</span>
        <span className="block text-muted-foreground text-xs">{t("upwork.cocheAide")}</span>
      </span>
    </label>
  );
}

function BoutonArreter({
  nom,
  enAttente,
  disabled,
  onArreter,
  onAnnuler,
}: {
  nom: string;
  enAttente: UpworkAction | null;
  disabled: boolean;
  onArreter: (note: string | null) => void;
  onAnnuler: (id: string) => void;
}) {
  const { t } = useTranslation();

  if (enAttente) {
    return (
      <span className="inline-flex items-center gap-2">
        <Badge variant="warning" size="sm">
          {t("upwork.actionEnAttente")}
        </Badge>
        <Button variant="ghost" size="xs" disabled={disabled} onClick={() => onAnnuler(enAttente.id)}>
          {t("upwork.actionAnnuler")}
        </Button>
      </span>
    );
  }

  return (
    <Button
      variant="destructive-outline"
      size="xs"
      disabled={disabled}
      onClick={() => {
        const note = window.prompt(t("upwork.arreterConfirm", { nom }));
        if (note === null) return;
        onArreter(note.trim() || null);
      }}
    >
      <OctagonX className="size-3.5" />
      {t("upwork.arreter")}
    </Button>
  );
}

function CarteCreateur({
  a,
  actions,
  actionsBloquees,
  onArreter,
  onAnnuler,
}: {
  a: UpworkApproche;
  actions: UpworkAction[];
  actionsBloquees: boolean;
  onArreter: (proposalId: string, note: string | null) => void;
  onAnnuler: (id: string) => void;
}) {
  const etapes = timelineCreateur(faitsDepuisApproche(a));
  const enAttente =
    actions.find((x) => x.upwork_proposal_id === a.upwork_proposal_id && x.statut === "en_attente") ??
    null;

  return (
    <div className="rounded-lg border bg-background p-3">
      <Repliable entete={<EntetePersonne a={a} etapes={etapes} taille="sm" />}>
        <Deroule etapes={etapes} role="createur" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <LienUpwork url={a.upwork_profile_url} label="Upwork" />
          <BoutonArreter
            nom={a.nom}
            enAttente={enAttente}
            disabled={actionsBloquees}
            onArreter={(note) => onArreter(a.upwork_proposal_id, note)}
            onAnnuler={onAnnuler}
          />
        </div>
      </Repliable>
    </div>
  );
}

function BandeauPhase({
  titre,
  extra,
  children,
  verrouille,
}: {
  titre: string;
  extra?: string;
  children: ReactNode;
  verrouille?: boolean;
}) {
  return (
    <section className={cn("rounded-xl border bg-muted/30 p-3", verrouille && "opacity-70")}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-sm">{titre}</h3>
        {extra && <p className="text-muted-foreground text-xs tabular-nums">{extra}</p>}
      </div>
      {children}
    </section>
  );
}

function VieHm({
  hm,
  jobCrea,
  approchesCrea,
  createursN,
  actions,
  actionsBloquees,
  onArreter,
  onAnnuler,
  onToggleUpwork,
}: {
  hm: UpworkApproche;
  jobCrea: UpworkMission | null;
  approchesCrea: UpworkApproche[];
  createursN: number;
  actions: UpworkAction[];
  actionsBloquees: boolean;
  onArreter: (proposalId: string, note: string | null) => void;
  onAnnuler: (id: string) => void;
  onToggleUpwork: (proposalId: string, ok: boolean) => void;
}) {
  const { t } = useTranslation();
  const faits = faitsDepuisApproche(hm);
  const etapes = timelineHm(faits);
  const p1ok = phase1Terminee(faits);
  const embauches = approchesCrea.filter((a) => a.statut === "hired").length;
  const n = Math.max(createursN, embauches);
  const opp = jobCrea ? opportunitesEnCours(approchesCrea, jobCrea.job_posting_id) : 0;
  const enAttente =
    actions.find(
      (x) => x.upwork_proposal_id === hm.upwork_proposal_id && x.statut === "en_attente",
    ) ?? null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Repliable entete={<EntetePersonne a={hm} etapes={etapes} taille="md" />}>
              <BandeauPhase titre={t("upwork.phase1")}>
                <Deroule etapes={etapes} role="hm" />
                <CocheAdmin
                  ok={hm.upwork_ajoute_ok}
                  disabled={actionsBloquees}
                  onChange={(v) => onToggleUpwork(hm.upwork_proposal_id, v)}
                />
              </BandeauPhase>
            </Repliable>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LienUpwork url={hm.upwork_profile_url} label={t("upwork.lienUpwork")} />
            <BoutonArreter
              nom={hm.nom}
              enAttente={enAttente}
              disabled={actionsBloquees}
              onArreter={(note) => onArreter(hm.upwork_proposal_id, note)}
              onAnnuler={onAnnuler}
            />
          </div>
        </div>

        <BandeauPhase
          titre={t("upwork.phase2")}
          extra={t("upwork.phase2Progress", { n, max: OBJECTIF_CREATEURS })}
          verrouille={!p1ok}
        >
          {!p1ok ? (
            <p className="text-muted-foreground text-sm">{t("upwork.phase2Avant")}</p>
          ) : (
            <Repliable
              entete={
                <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                  <Briefcase className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate font-medium">
                    {jobCrea?.titre ?? t("upwork.jobCreaVide")}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {t("upwork.personnesRepondu", { n: approchesCrea.length })}
                  </span>
                </span>
              }
            >
              <div className="space-y-3">
                {jobCrea && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-muted-foreground text-xs">
                      {t("upwork.statsPost", {
                        inv: jobCrea.invites_sent,
                        opp,
                        appl: jobCrea.applicants,
                        hired: jobCrea.hired,
                      })}
                    </p>
                    <LienUpwork url={jobCrea.job_url} label={t("upwork.lienJob")} />
                  </div>
                )}
                {approchesCrea.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t("upwork.approcheVide")}</p>
                ) : (
                  <div className="space-y-2">
                    {approchesCrea.map((a) => (
                      <CarteCreateur
                        key={a.id}
                        a={a}
                        actions={actions}
                        actionsBloquees={actionsBloquees}
                        onArreter={onArreter}
                        onAnnuler={onAnnuler}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Repliable>
          )}
        </BandeauPhase>
      </CardContent>
    </Card>
  );
}

export function AdminUpworkPaysPage() {
  const { t, i18n } = useTranslation();
  const { langue: raw } = useParams();
  const langue = (raw ?? "").toLowerCase();
  const queryClient = useQueryClient();

  const dash = useQuery({
    queryKey: ["upwork-dashboard"],
    queryFn: chargerUpworkDashboard,
  });

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["upwork-dashboard"] });

  const basculerUpwork = useMutation({
    mutationFn: (v: { proposalId: string; ok: boolean }) => marquerAjoutUpwork(v.proposalId, v.ok),
    onSuccess: rafraichir,
  });

  const arreter = useMutation({
    mutationFn: (v: { proposalId: string; note: string | null }) =>
      creerActionUpwork("arreter_recrutement", v.proposalId, v.note ?? undefined),
    onSuccess: rafraichir,
  });

  const annuler = useMutation({
    mutationFn: (id: string) => annulerActionUpwork(id),
    onSuccess: rafraichir,
  });

  const lancerCampagne = useMutation({
    mutationFn: (v: { langue: string; pays: string }) => lancerCampagneHm(v.langue, v.pays),
    onSuccess: rafraichir,
  });

  const arreterCampagne = useMutation({
    mutationFn: (id: string) => arreterCampagneHm(id),
    onSuccess: rafraichir,
  });

  const deciderProfil = useMutation({
    mutationFn: (v: { id: string; ok: boolean }) => deciderCandidat(v.id, v.ok),
    onSuccess: rafraichir,
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
  const actions = d?.actions ?? [];
  const hms = jobsHm
    .flatMap((j) => approchesDuJob(approches, j.job_posting_id))
    .filter((a) => a.role === "hm");

  const campagne = campagneDuPays(d?.campagnes ?? [], langue);
  const candidats = campagne ? candidatsDeCampagne(d?.candidats ?? [], campagne.id) : [];
  const paysNom = nomPays(langue, i18n.language);

  const enCours =
    basculerUpwork.isPending ||
    arreter.isPending ||
    annuler.isPending ||
    lancerCampagne.isPending ||
    arreterCampagne.isPending ||
    deciderProfil.isPending;
  const erreur = (basculerUpwork.error ??
    arreter.error ??
    annuler.error ??
    lancerCampagne.error ??
    arreterCampagne.error ??
    deciderProfil.error) as Error | null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/upwork"
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("upwork.retourDash")}
        </Link>
        <h1 className="mt-2 flex items-center gap-2 font-semibold text-lg tracking-tight">
          <span aria-hidden>{drapeauLangue(langue)}</span>
          {nomPays(langue, i18n.language)}
        </h1>
      </div>

      {dash.isPending && <p className="text-muted-foreground text-sm">{t("common.loading")}</p>}
      {dash.isError && (
        <p className="text-destructive text-sm">
          {(dash.error as Error).message || t("common.error")}
        </p>
      )}
      {erreur && <p className="text-destructive text-sm">{erreur.message}</p>}

      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Total icone={ICONE_KPI.hm} label={t("upwork.kpiHm")} valeur={String(pays?.hms ?? 0)} />
            <Total
              icone={ICONE_KPI.createurs}
              label={t("upwork.kpiCreateurs")}
              valeur={String(pays?.createurs ?? 0)}
            />
            <Total
              icone={ICONE_KPI.jobHm}
              label={t("upwork.kpiJobHmOuverts")}
              valeur={String(pays?.jobsHmOuverts ?? 0)}
            />
            <Total
              icone={ICONE_KPI.jobCrea}
              label={t("upwork.kpiJobCreaOuverts")}
              valeur={String(pays?.jobsCreateursOuverts ?? 0)}
            />
          </div>

          <JobsHm
            paysNom={paysNom}
            jobsHm={jobsHm}
            campagne={campagne}
            candidats={candidats}
            actions={actions}
            bloque={enCours}
            onLancer={() => lancerCampagne.mutate({ langue, pays: paysNom })}
            onArreter={(id) => arreterCampagne.mutate(id)}
            onDecider={(id, ok) => deciderProfil.mutate({ id, ok })}
          />

          {hms.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("upwork.approcheVide")}</p>
          ) : (
            <div className="space-y-3">
              {hms.map((hm) => {
                const jobCrea = jobCreateurPourHm(hm, jobsCrea, hms, d.contrats ?? []);
                const approchesCrea = jobCrea
                  ? approchesDuJob(approches, jobCrea.job_posting_id)
                  : [];
                const contrat = (d.contrats ?? []).find(
                  (c) => c.contract_id && c.contract_id === hm.contract_id,
                );
                return (
                  <VieHm
                    key={hm.id}
                    hm={{ ...hm, job_createur_id: jobCrea?.job_posting_id ?? null }}
                    jobCrea={jobCrea}
                    approchesCrea={approchesCrea}
                    createursN={contrat?.createurs_n ?? 0}
                    actions={actions}
                    actionsBloquees={enCours}
                    onArreter={(proposalId, note) => arreter.mutate({ proposalId, note })}
                    onAnnuler={(id) => annuler.mutate(id)}
                    onToggleUpwork={(proposalId, ok) => basculerUpwork.mutate({ proposalId, ok })}
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
