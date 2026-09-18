import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, MoveDown, MoveUp, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { listerHistoriqueTier, type EntreeTierHistorique } from "@/features/moteur/api";

/**
 * Le journal des cycles d'un slideshow : « B → B le 17/09 », « A → S le 12/09 ».
 *
 * Le tier seul ne dit pas d'où vient le slideshow. Les lignes sont posées par
 * trigger (migration 0270) à chaque requalification, y compris quand le tier ne
 * bouge pas — un cycle réglé sans changement de bande est une information.
 */

const ORDRE = ["D", "C", "B", "A", "S", "S+"] as const;

function sens(avant: string | null, apres: string | null): "monte" | "descend" | "egal" {
  if (!avant || !apres) return "egal";
  const a = ORDRE.indexOf(avant as (typeof ORDRE)[number]);
  const b = ORDRE.indexOf(apres as (typeof ORDRE)[number]);
  if (a < 0 || b < 0 || a === b) return "egal";
  return b > a ? "monte" : "descend";
}

function LigneTier({ e }: { e: EntreeTierHistorique }) {
  const { t, i18n } = useTranslation();
  const direction = sens(e.tier_avant, e.tier_apres);
  const Fleche =
    direction === "monte" ? MoveUp : direction === "descend" ? MoveDown : Minus;

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border px-2 py-1.5 text-xs">
      <Fleche
        className={
          direction === "monte"
            ? "size-3.5 text-emerald-600"
            : direction === "descend"
              ? "size-3.5 text-destructive"
              : "size-3.5 text-muted-foreground"
        }
      />
      <span className="inline-flex items-center gap-1 font-medium">
        {e.tier_avant ? (
          <>
            <Badge variant="outline" className="text-[10px]">
              {e.tier_avant}
            </Badge>
            <ArrowRight className="size-3 text-muted-foreground" />
          </>
        ) : null}
        <Badge variant="secondary" className="text-[10px] font-semibold">
          {e.tier_apres ?? "—"}
        </Badge>
      </span>
      <span className="text-muted-foreground">
        {new Date(e.fait_le).toLocaleDateString(i18n.language)}
      </span>
      <span className="text-muted-foreground">
        · {t(`slideshows.motif_${e.motif}`, { defaultValue: e.motif })}
      </span>
      {e.passages_cible_apres != null && (
        <span className="tabular-nums text-muted-foreground">
          ·{" "}
          {t("slideshows.cibleHistorique", {
            avant: e.passages_cible_avant ?? "—",
            apres: e.passages_cible_apres,
          })}
        </span>
      )}
    </li>
  );
}

export function HistoriqueTier({ contenuId }: { contenuId: string }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["historique-tier", contenuId],
    queryFn: () => listerHistoriqueTier(contenuId),
    enabled: Boolean(contenuId),
  });

  if (q.isPending) {
    return <p className="text-xs text-muted-foreground">{t("common.loading")}</p>;
  }
  if (q.isError) {
    return (
      <p className="text-xs text-destructive">{(q.error as Error).message}</p>
    );
  }
  if ((q.data ?? []).length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{t("slideshows.historiqueTierVide")}</p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {(q.data ?? []).map((e) => (
        <LigneTier key={e.id} e={e} />
      ))}
    </ul>
  );
}
