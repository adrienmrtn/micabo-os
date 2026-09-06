import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import { ICONE_CHECK, ICONE_ETAPE } from "./icones";
import type { EtapeTimelineCle, SourceVerite, TimelineCheck, TimelineEtape } from "./timeline";
import { avancement, etapeCouranteTimeline } from "./timeline";

/** Bloc dont le contenu reste caché tant qu'on n'a pas cliqué. */
export function Repliable({
  entete,
  children,
  ouvertDefaut = false,
  className,
}: {
  entete: React.ReactNode;
  children: React.ReactNode;
  ouvertDefaut?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [ouvert, setOuvert] = React.useState(ouvertDefaut);
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1">{entete}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
          {ouvert ? t("upwork.voirMoins") : t("upwork.voirPlus")}
          <ChevronDown className={cn("size-3.5 transition-transform", ouvert && "rotate-180")} />
        </span>
      </button>
      {ouvert ? <div className="pt-3">{children}</div> : null}
    </div>
  );
}

function Source({ source }: { source: SourceVerite }) {
  const { t } = useTranslation();
  return (
    <span className="shrink-0 rounded border px-1 py-px font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
      {t(`upwork.source.${source}`)}
    </span>
  );
}

/** Déroulé vertical : une ligne par étape, la courante mise en avant. */
export function Deroule({
  etapes,
  onCocher,
  onCocherEtape,
  cocheEnCours,
  encart,
}: {
  etapes: TimelineEtape[];
  /** Bascule une case dont l'admin est la source de vérité. */
  onCocher?: (cle: TimelineCheck["cle"], ok: boolean) => void;
  onCocherEtape?: (cle: EtapeTimelineCle, ok: boolean) => void;
  cocheEnCours?: boolean;
  /** Ce qu'on glisse sous une étape : message à envoyer, lien de contrat… */
  encart?: (etape: TimelineEtape, courante: boolean) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const courante = etapeCouranteTimeline(etapes);

  return (
    <ol className="relative">
      {etapes.map((e, i) => {
        const ici = e.cle === courante && !e.ok;
        const Icone = ICONE_ETAPE[e.cle];
        const dernier = i === etapes.length - 1;
        const etapeCochable = Boolean(e.cochable && onCocherEtape);
        const pastilleClasse = cn(
          "z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border",
          e.ok && "border-transparent bg-foreground text-background",
          ici && "border-foreground border-dashed bg-background text-foreground",
          !e.ok && !ici && "border-dashed bg-background text-muted-foreground/60",
          etapeCochable && "transition-colors hover:border-foreground",
        );
        const pastille = e.ok ? <Check className="size-3.5" /> : <Icone className="size-3.5" />;
        return (
          <li key={e.cle} className={cn("relative flex gap-3", !dernier && "pb-3")}>
            {!dernier && (
              <span className="absolute top-7 bottom-0 left-[13px] w-px bg-border" aria-hidden />
            )}
            {etapeCochable ? (
              <button
                type="button"
                aria-pressed={e.ok}
                aria-label={t(`upwork.timeline.${e.cle}`)}
                disabled={cocheEnCours}
                title={t("upwork.cocherIndice")}
                onClick={() => onCocherEtape?.(e.cle, !e.ok)}
                className={cn(pastilleClasse, "disabled:opacity-50")}
              >
                {pastille}
              </button>
            ) : (
              <span className={pastilleClasse}>{pastille}</span>
            )}

            <div className="min-w-0 flex-1 pt-1">
              <p
                className={cn(
                  "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm",
                  e.ok && "font-medium",
                  ici && "font-semibold",
                  !e.ok && !ici && "text-muted-foreground",
                )}
              >
                {t(`upwork.timeline.${e.cle}`)}
                {ici && (
                  <span className="rounded-full bg-foreground px-1.5 py-px font-medium text-[10px] text-background uppercase tracking-wide">
                    {t("upwork.etapeCourante")}
                  </span>
                )}
                {e.detail && <span className="text-muted-foreground text-xs">{e.detail}</span>}
              </p>

              {e.cle === "pourparlers" && e.dernierMessage && (
                <blockquote className="mt-1.5 space-y-1 rounded-md border bg-background px-2.5 py-2">
                  <p className="font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                    {t("upwork.dernierMessage")}
                  </p>
                  <p className="whitespace-pre-wrap text-xs leading-snug">
                    {e.dernierMessage}
                  </p>
                  {e.dernierMessageAt && (
                    <time
                      className="block text-[10px] text-muted-foreground"
                      dateTime={e.dernierMessageAt}
                    >
                      {new Date(e.dernierMessageAt).toLocaleString()}
                    </time>
                  )}
                </blockquote>
              )}
              {e.cle === "pourparlers" && !e.dernierMessage && e.resume && (
                <p className="mt-1.5 text-muted-foreground text-xs">{e.resume}</p>
              )}

              {e.checks && (
                <ul className="mt-1.5 space-y-1">
                  {e.checks.map((c) => (
                    <li key={c.cle}>
                      <LigneCheck
                        check={c}
                        onCocher={onCocher}
                        enCours={Boolean(cocheEnCours)}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {encart?.(e, ici)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Une case cochable se clique directement sur sa pastille — pas d'interrupteur
 * à côté du texte.
 */
function LigneCheck({
  check,
  onCocher,
  enCours,
}: {
  check: TimelineCheck;
  onCocher?: (cle: TimelineCheck["cle"], ok: boolean) => void;
  enCours: boolean;
}) {
  const { t } = useTranslation();
  const Icone = ICONE_CHECK[check.cle];
  const cochable = Boolean(check.cochable && onCocher);

  const pastille = (
    <span
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full transition-colors",
        check.ok ? "bg-foreground text-background" : "border border-dashed",
        cochable && !check.ok && "border-foreground/40 group-hover:border-foreground",
        cochable && check.ok && "group-hover:bg-foreground/80",
      )}
    >
      {check.ok && <Check className="size-2.5" />}
    </span>
  );

  const corps = (
    <>
      <Icone className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className={cn(!check.ok && "text-muted-foreground")}>
        {t(`upwork.timeline.check.${check.cle}`)}
      </span>
      <Source source={check.source} />
    </>
  );

  if (!cochable) {
    return (
      <span className="flex items-center gap-1.5 text-xs">
        {pastille}
        {corps}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={check.ok}
      disabled={enCours}
      onClick={() => onCocher?.(check.cle, !check.ok)}
      title={t("upwork.cocherIndice")}
      className="group -mx-1 flex items-center gap-1.5 rounded px-1 py-0.5 text-xs transition-colors hover:bg-muted/60 disabled:opacity-50"
    >
      {pastille}
      {corps}
    </button>
  );
}

/** Résumé d'une ligne : où on en est, sans déplier. */
export function ResumeEtape({ etapes }: { etapes: TimelineEtape[] }) {
  const { t } = useTranslation();
  const courante = etapeCouranteTimeline(etapes);
  const { faites, total } = avancement(etapes);
  const fini = faites === total;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
      <span className="tabular-nums">{t("upwork.avancement", { n: faites, max: total })}</span>
      <span aria-hidden>·</span>
      <span className={cn("truncate", !fini && "text-foreground")}>
        {fini ? t("upwork.toutFait") : t(`upwork.timeline.${courante}`)}
      </span>
    </span>
  );
}

/** Jauge fine : lisible d'un coup d'œil au-dessus d'une liste de fiches. */
export function Jauge({ faites, total }: { faites: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((faites / total) * 100);
  return (
    <span className="block h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className="block h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
    </span>
  );
}
