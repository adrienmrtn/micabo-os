import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import { ICONE_CHECK, ICONE_ETAPE } from "./icones";
import type { SourceVerite, TimelineEtape } from "./timeline";
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
  role,
}: {
  etapes: TimelineEtape[];
  role: "hm" | "createur";
}) {
  const { t } = useTranslation();
  const courante = etapeCouranteTimeline(etapes);

  return (
    <ol className="relative">
      {etapes.map((e, i) => {
        const ici = e.cle === courante && !e.ok;
        const Icone = ICONE_ETAPE[e.cle];
        const dernier = i === etapes.length - 1;
        return (
          <li key={e.cle} className={cn("relative flex gap-3", !dernier && "pb-3")}>
            {!dernier && (
              <span className="absolute top-7 bottom-0 left-[13px] w-px bg-border" aria-hidden />
            )}
            <span
              className={cn(
                "z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border",
                e.ok && "border-transparent bg-foreground text-background",
                ici && "border-foreground border-dashed bg-background text-foreground",
                !e.ok && !ici && "border-dashed bg-background text-muted-foreground/60",
              )}
            >
              {e.ok ? <Check className="size-3.5" /> : <Icone className="size-3.5" />}
            </span>

            <div className="min-w-0 flex-1 pt-1">
              <p
                className={cn(
                  "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm",
                  e.ok && "font-medium",
                  ici && "font-semibold",
                  !e.ok && !ici && "text-muted-foreground",
                )}
              >
                {e.cle === "acces_envoyes" && role === "createur"
                  ? t("upwork.timeline.acces_envoyes_crea")
                  : t(`upwork.timeline.${e.cle}`)}
                {ici && (
                  <span className="rounded-full bg-foreground px-1.5 py-px font-medium text-[10px] text-background uppercase tracking-wide">
                    {t("upwork.etapeCourante")}
                  </span>
                )}
                {e.detail && <span className="text-muted-foreground text-xs">{e.detail}</span>}
              </p>

              {e.cle === "pourparlers" && e.resume && (
                <p className="mt-1 text-muted-foreground text-xs leading-snug">{e.resume}</p>
              )}

              {e.checks && (
                <ul className="mt-1.5 space-y-1">
                  {e.checks.map((c) => {
                    const IconeCheck = ICONE_CHECK[c.cle];
                    return (
                      <li key={c.cle} className="flex items-center gap-1.5 text-xs">
                        <span
                          className={cn(
                            "inline-flex size-4 items-center justify-center rounded-full",
                            c.ok ? "bg-foreground text-background" : "border border-dashed",
                          )}
                        >
                          {c.ok && <Check className="size-2.5" />}
                        </span>
                        <IconeCheck className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                        <span className={cn(!c.ok && "text-muted-foreground")}>
                          {t(`upwork.timeline.check.${c.cle}`)}
                        </span>
                        <Source source={c.source} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
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
