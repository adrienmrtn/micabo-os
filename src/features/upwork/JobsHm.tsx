import { Briefcase, Check, ExternalLink, Rocket, Timer, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Repliable } from "./Deroule";
import { etatCampagne, heuresAvantAuto, triCandidats } from "./campagne";
import type {
  UpworkAction,
  UpworkCampagne,
  UpworkCandidat,
  UpworkMission,
} from "./types";

function Vignette({
  nom,
  url,
  taille = "md",
}: {
  nom: string;
  url: string | null;
  taille?: "sm" | "md";
}) {
  const dim = taille === "sm" ? "size-8 text-[10px]" : "size-14 text-sm";
  if (url) {
    return (
      <img
        src={url}
        alt={nom}
        className={cn("shrink-0 rounded-lg object-cover", dim)}
        referrerPolicy="no-referrer"
      />
    );
  }
  const lettres = nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-muted font-medium text-muted-foreground",
        dim,
      )}
      aria-hidden
    >
      {lettres || "?"}
    </span>
  );
}

/** Combien de temps avant l'invitation automatique. */
function Echeance({ candidat }: { candidat: UpworkCandidat }) {
  const { t } = useTranslation();
  const h = heuresAvantAuto(candidat.echeance_at);
  const depasse = h <= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        depasse ? "font-medium text-warning-foreground" : "text-muted-foreground",
      )}
    >
      <Timer className="size-3" aria-hidden />
      {depasse
        ? t("upwork.autoMaintenant")
        : t("upwork.autoDans", { h: Math.max(1, Math.round(h)) })}
    </span>
  );
}

function CarteCandidat({
  candidat,
  bloque,
  onDecider,
}: {
  candidat: UpworkCandidat;
  bloque: boolean;
  onDecider: (id: string, ok: boolean) => void;
}) {
  const { t } = useTranslation();
  const details = [
    candidat.pays,
    candidat.taux_horaire != null ? `$${candidat.taux_horaire}/h` : null,
    candidat.job_success != null ? `JSS ${Math.round(candidat.job_success)}%` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border bg-background p-3">
      <Vignette nom={candidat.nom} url={candidat.photo_url} taille="md" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm">{candidat.nom}</span>
          {candidat.upwork_profile_url && (
            <a
              href={candidat.upwork_profile_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
            >
              Upwork
              <ExternalLink className="size-3" />
            </a>
          )}
        </p>
        {candidat.titre_profil && (
          <p className="truncate text-muted-foreground text-xs">{candidat.titre_profil}</p>
        )}
        {details.length > 0 && (
          <p className="text-muted-foreground text-xs">{details.join(" · ")}</p>
        )}
        {candidat.pourquoi && <p className="text-xs leading-snug">{candidat.pourquoi}</p>}
        <Echeance candidat={candidat} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="xs" disabled={bloque} onClick={() => onDecider(candidat.id, true)}>
          <Check className="size-3.5" />
          {t("upwork.candidatValider")}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={bloque}
          onClick={() => onDecider(candidat.id, false)}
        >
          <X className="size-3.5" />
          {t("upwork.candidatRefuser")}
        </Button>
      </div>
    </div>
  );
}

function LigneDecide({ candidat }: { candidat: UpworkCandidat }) {
  const { t } = useTranslation();
  const variante =
    candidat.statut === "invite" ? "success" : candidat.statut === "refuse" ? "outline" : "info";
  return (
    <li className="flex flex-wrap items-center gap-2 py-1 text-sm">
      <Vignette nom={candidat.nom} url={candidat.photo_url} taille="sm" />
      <span className="font-medium">{candidat.nom}</span>
      <Badge variant={variante} size="sm">
        {t(`upwork.candidatStatut.${candidat.statut}`)}
      </Badge>
      {candidat.auto_valide && (
        <span className="text-muted-foreground text-xs">{t("upwork.candidatAuto")}</span>
      )}
    </li>
  );
}

/** Le bloc « Jobs HM » d'un pays : les posts, la campagne, les profils à trancher. */
export function JobsHm({
  paysNom,
  jobsHm,
  campagne,
  candidats,
  actions,
  bloque,
  hmEnPlace,
  onLancer,
  onArreter,
  onDecider,
}: {
  paysNom: string;
  jobsHm: UpworkMission[];
  campagne: UpworkCampagne | null;
  candidats: UpworkCandidat[];
  actions: UpworkAction[];
  bloque: boolean;
  /** HM déjà embauchés sur ce pays : relancer empile un job de plus. */
  hmEnPlace: number;
  onLancer: () => void;
  onArreter: (id: string) => void;
  onDecider: (id: string, ok: boolean) => void;
}) {
  const { t } = useTranslation();
  const etat = etatCampagne(campagne, actions, candidats);
  const { aValider, decides } = triCandidats(candidats);

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold text-sm">
            <Briefcase className="size-4 text-muted-foreground" aria-hidden />
            {t("upwork.sectionJobHm")}
          </h2>
          <p className="mt-1 text-muted-foreground text-xs">
            {etat.cle === "en_cours"
              ? etat.prochaine
                ? t("upwork.campagneProchaine", {
                    etape: t(`upwork.action.${etat.prochaine}`),
                  })
                : t("upwork.campagneAttente", { n: etat.attenteAdmin })
              : etat.cle === "terminee"
                ? t("upwork.campagneTerminee", { n: hmEnPlace })
                : etat.cle === "arretee"
                  ? t("upwork.campagneArretee")
                  : t("upwork.campagneAbsente", { pays: paysNom })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {etat.cle === "en_cours" ? (
            <>
              <Badge variant="info" size="sm">
                {t("upwork.campagneActive")}
              </Badge>
              <Button
                variant="ghost"
                size="xs"
                disabled={bloque}
                onClick={() => onArreter(etat.campagne.id)}
              >
                {t("upwork.campagneArreter")}
              </Button>
            </>
          ) : (
            <Button
              size="xs"
              disabled={bloque}
              onClick={() => {
                if (!window.confirm(t("upwork.campagneConfirm", { pays: paysNom }))) return;
                onLancer();
              }}
            >
              <Rocket className="size-3.5" />
              {t("upwork.campagneLancer")}
            </Button>
          )}
        </div>
      </div>

      {jobsHm.length > 0 && (
        <ul className="mt-3 space-y-1 border-t pt-3">
          {jobsHm.map((j) => (
            <li key={j.job_posting_id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="truncate font-medium text-sm">{j.titre}</span>
              <span className="text-muted-foreground text-xs">
                {t("upwork.statsPost", {
                  inv: j.invites_sent,
                  opp: j.messaged,
                  appl: j.applicants,
                  hired: j.hired,
                })}
              </span>
              {j.job_url && (
                <a
                  href={j.job_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
                >
                  {t("upwork.lienJob")}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {aValider.length > 0 && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="font-medium text-sm">
            {t("upwork.candidatsAValider", { n: aValider.length })}
          </p>
          <p className="text-muted-foreground text-xs">
            {t("upwork.candidatsAide", {
              h: campagne?.delai_validation_h ?? 10,
            })}
          </p>
          {aValider.map((c) => (
            <CarteCandidat key={c.id} candidat={c} bloque={bloque} onDecider={onDecider} />
          ))}
        </div>
      )}

      {decides.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <Repliable
            entete={
              <span className="text-muted-foreground text-sm">
                {t("upwork.candidatsDecides", { n: decides.length })}
              </span>
            }
          >
            <ul className="divide-y">
              {decides.map((c) => (
                <LigneDecide key={c.id} candidat={c} />
              ))}
            </ul>
          </Repliable>
        </div>
      )}
    </section>
  );
}
