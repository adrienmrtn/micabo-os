import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, MoveDown, MoveUp } from "lucide-react";

import { QualificationBadge } from "@/components/moteur/QualificationBadge";
import {
  listerHistoriqueQualification,
  type EntreeQualificationHistorique,
} from "@/features/moteur/api";
import { indexQualification } from "@/features/moteur/qualification";

/**
 * Le journal des cases d'un compte : « BIEN → STAR le 17/09 ».
 *
 * Même logique que le journal des tiers (migration 0270) : la colonne
 * `comptes.qualification` ne garde que l'état courant, et « ce compte a été
 * STAR pendant une semaine » ne se lit nulle part.
 */

function sens(
  avant: EntreeQualificationHistorique["qualification_avant"],
  apres: EntreeQualificationHistorique["qualification_apres"],
): "monte" | "descend" | "egal" {
  if (!avant) return "egal";
  const a = indexQualification(avant);
  const b = indexQualification(apres);
  if (a < 0 || b < 0 || a === b) return "egal";
  return b > a ? "monte" : "descend";
}

export function HistoriqueQualification({ compteId }: { compteId: string }) {
  const { t, i18n } = useTranslation();
  const q = useQuery({
    queryKey: ["historique-qualification", compteId],
    queryFn: () => listerHistoriqueQualification(compteId),
    enabled: Boolean(compteId),
  });

  if (q.isPending) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (q.isError) {
    return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  }
  if ((q.data ?? []).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("adminCreateur.historiqueQualifVide")}
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {(q.data ?? []).map((e) => {
        const direction = sens(e.qualification_avant, e.qualification_apres);
        return (
          <li
            key={e.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2.5 py-2 text-sm"
          >
            {direction === "monte" && <MoveUp className="size-3.5 text-emerald-600" />}
            {direction === "descend" && <MoveDown className="size-3.5 text-destructive" />}
            {e.qualification_avant && (
              <>
                <QualificationBadge qualification={e.qualification_avant} size="sm" />
                <ArrowRight className="size-3 text-muted-foreground" />
              </>
            )}
            <QualificationBadge
              qualification={e.qualification_apres}
              manuelle={e.manuelle}
              size="sm"
            />
            <span className="text-xs text-muted-foreground">
              {new Date(e.fait_le).toLocaleDateString(i18n.language)}
            </span>
            {e.manuelle && (
              <span className="text-xs text-muted-foreground">
                · {t("adminCreateur.qualifManuelle")}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
