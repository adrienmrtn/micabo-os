import { ExternalLink, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import {
  alerteSurveillance,
  moyenneEquipe,
  ratioPosts,
  vuesMoyennes,
  type CreateurPhase3,
} from "./surveillance";

function formatNombre(n: number, locale: string, maxFrac = 0): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: maxFrac }).format(n);
}

function Ratio({
  posts,
  prevus,
  locale,
}: {
  posts: number;
  prevus: number;
  locale: string;
}) {
  const { t } = useTranslation();
  const ratio = ratioPosts({ posts_10j: posts, prevus_10j: prevus });
  return (
    <span className="tabular-nums">
      {t("upwork.phase3Ratio", {
        posts: formatNombre(posts, locale),
        prevus: formatNombre(prevus, locale),
      })}
      {ratio !== null && (
        <span className="text-muted-foreground">
          {" "}
          ({formatNombre(Math.round(ratio * 100), locale)} %)
        </span>
      )}
    </span>
  );
}

function Vues({
  vues,
  mesures,
  locale,
}: {
  vues: number;
  mesures: number;
  locale: string;
}) {
  const { t } = useTranslation();
  const moy = vuesMoyennes({ vues_10: vues, posts_mesures: mesures });
  return (
    <span className="tabular-nums">
      {t("upwork.phase3VuesVal", { vues: formatNombre(vues, locale) })}
      {mesures > 0 && (
        <span className="text-muted-foreground">
          {" "}
          ({t("upwork.phase3VuesMoy", { n: formatNombre(Math.round(moy), locale) })})
        </span>
      )}
    </span>
  );
}

export function Alerte({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <TriangleAlert
      className="size-3.5 shrink-0 text-amber-600"
      aria-label={t("upwork.phase3Alerte")}
    />
  );
}

export function ResumeEquipe({ createurs }: { createurs: CreateurPhase3[] }) {
  const { t, i18n } = useTranslation();
  const moy = moyenneEquipe(createurs);
  if (!moy) return null;
  const locale = i18n.language;
  return (
    <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <Alerte visible={alerteSurveillance(moy)} />
      <span className="font-medium">{t("upwork.phase3Moyenne")}</span>
      <span>
        {t("upwork.phase3Posts")} <Ratio posts={moy.posts_10j} prevus={moy.prevus_10j} locale={locale} />
      </span>
      <span>
        {t("upwork.phase3Vues")}{" "}
        <Vues vues={moy.vues_10} mesures={moy.posts_mesures} locale={locale} />
      </span>
    </p>
  );
}

export function CarteSurveillance({ c }: { c: CreateurPhase3 }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const alerte = alerteSurveillance(c);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-background px-3 py-2 text-sm",
        alerte && "border-amber-500/50",
      )}
    >
      <Alerte visible={alerte} />
      <span className="min-w-0 flex-1 font-medium">{c.nom}</span>
      {c.tiktokUrl ? (
        <a
          href={c.tiktokUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
        >
          {c.handle}
          <ExternalLink className="size-3" />
        </a>
      ) : (
        <span className="text-muted-foreground text-xs">{c.handle ?? "—"}</span>
      )}
      <span className="text-xs">
        {t("upwork.phase3Posts")}{" "}
        <Ratio posts={c.posts_10j} prevus={c.prevus_10j} locale={locale} />
      </span>
      <span className="text-xs">
        {t("upwork.phase3Vues")}{" "}
        <Vues vues={c.vues_10} mesures={c.posts_mesures} locale={locale} />
      </span>
      <span className="text-xs tabular-nums">
        {t("upwork.phase3Elo")} {c.elo !== null ? formatNombre(c.elo, locale) : "—"}
      </span>
    </div>
  );
}
