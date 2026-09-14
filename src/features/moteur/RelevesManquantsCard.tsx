import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { lancerRattrapageElo } from "@/features/moteur/api";
import { compterRelevesManquants } from "@/features/moteur/fileValidationApi";
import { cn } from "@/lib/utils";

/**
 * Où en est le relevé des vues.
 *
 * Le moteur relève désormais « ce qui manque » et non plus une fenêtre de
 * quatre jours : un passage raté n'est plus perdu, il reste en tête de file
 * jusqu'à ce qu'il soit mesuré. Ce bandeau dit ce qu'il reste à rattraper — et
 * sépare les passages tout juste publiés (normaux, ils mûrissent 45 min) des
 * vrais manquants.
 */
export function RelevesManquantsCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const resume = useQuery({
    queryKey: ["releves-manquants"],
    queryFn: compterRelevesManquants,
    staleTime: 30_000,
  });

  const relancer = useMutation({
    mutationFn: () => lancerRattrapageElo(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["releves-manquants"] });
    },
  });

  const r = resume.data;
  if (resume.isPending || !r) return null;

  const rien = r.manquants === 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-xs",
        rien ? "border-border bg-muted/20" : "border-warning/40 bg-warning/10",
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className={cn("text-sm font-medium", !rien && "text-warning")}>
          {rien
            ? t("releves.toutMesure", { n: r.mesures })
            : t("releves.manquants", { n: r.manquants })}
        </p>
        <p className="text-muted-foreground">
          {t("releves.detail", {
            publies: r.publies,
            mesures: r.mesures,
            recents: r.tropRecents,
            assignes: r.nonPublies,
          })}
        </p>
        {!rien && <p className="text-muted-foreground">{t("releves.aide")}</p>}
      </div>
      {!rien && (
        <Button
          size="sm"
          variant="outline"
          disabled={relancer.isPending}
          onClick={() => relancer.mutate()}
        >
          {relancer.isPending ? t("common.loading") : t("releves.relancer")}
        </Button>
      )}
      {relancer.isError && (
        <p className="text-destructive">{(relancer.error as Error).message}</p>
      )}
    </div>
  );
}
