import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MessageSquareQuote } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { marquerReviewVue, mesReviewsNonVues } from "@/features/moteur/api";
import { etapesReview } from "@/features/reviews/fileQuotidienne";
import { LecteurRemarque } from "@/features/reviews/LecteurRemarque";

/**
 * Pop-up de review pour le poster : à sa connexion, s'il a une (ou plusieurs)
 * review non vue, elle s'affiche par-dessus tout. « Compris » la marque vue et
 * enchaîne sur la suivante s'il y en a. Rien à afficher → rien ne se monte.
 *
 * Deux niveaux d'enchaînement, à ne pas confondre : à l'intérieur d'un retour,
 * chaque puce illustrée passe sa vidéo avant le texte ; puis on enchaîne sur le
 * retour suivant. Une review sans vidéo garde exactement l'écran d'avant.
 */
export function ReviewPopup() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["mes-reviews"], queryFn: mesReviewsNonVues });

  const marquer = useMutation({
    mutationFn: marquerReviewVue,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mes-reviews"] }),
  });

  const courante = (data ?? [])[0];
  const [index, setIndex] = React.useState(0);
  const [vue, setVue] = React.useState(false);

  // Retour suivant : on repart de sa première étape.
  React.useEffect(() => {
    setIndex(0);
    setVue(false);
  }, [courante?.id]);

  const marquerVue = React.useCallback(() => setVue(true), []);

  if (!courante) return null;

  const etapes = etapesReview(courante);
  const etape = etapes[Math.min(index, etapes.length - 1)];
  const derniere = index >= etapes.length - 1;
  // Sur une étape vidéo, « Suivant » attend la fin de la lecture (ou son échec).
  const bloque = etape.type === "video" && !vue;

  return (
    <Dialog open disablePointerDismissal>
      <DialogPopup showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <MessageSquareQuote className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-base">{t("reviews.popupTitre")}</DialogTitle>
              <DialogDescription>{t("reviews.popupSous")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          {(courante.publie_url || courante.source_url || courante.handle_tiktok) && (
            <p className="text-xs text-muted-foreground">
              {courante.handle_tiktok
                ? t("reviews.popupPost", { handle: courante.handle_tiktok })
                : t("reviews.popupPostSansHandle")}
              {courante.publie_url ? (
                <>
                  {" · "}
                  <a
                    href={courante.publie_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {t("reviews.popupLienPoste")}
                  </a>
                </>
              ) : null}
              {courante.source_url ? (
                <>
                  {" · "}
                  <a
                    href={courante.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {t("reviews.popupLienOrigine")}
                  </a>
                </>
              ) : null}
            </p>
          )}
          {etape.type === "video" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{etape.titre}</p>
              <LecteurRemarque key={etape.id} url={etape.videoUrl} onVue={marquerVue} />
              <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
                {etape.corps}
              </p>
            </div>
          ) : (
            <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
              {etape.body}
            </p>
          )}
        </DialogPanel>
        <DialogFooter className="items-center">
          {etapes.length > 1 && (
            <span className="mr-auto text-xs text-muted-foreground">
              {t("reviews.etape", { n: index + 1, total: etapes.length })}
            </span>
          )}
          {derniere ? (
            <Button
              className="w-full sm:w-auto"
              size="lg"
              loading={marquer.isPending}
              onClick={() => marquer.mutate(courante.id)}
            >
              {marquer.isPending ? t("common.saving") : t("reviews.compris")}
            </Button>
          ) : (
            <Button
              className="w-full sm:w-auto"
              size="lg"
              disabled={bloque}
              onClick={() => {
                setIndex((i) => i + 1);
                setVue(false);
              }}
            >
              {bloque ? t("reviews.suivantApresVideo") : t("reviews.suivant")}
            </Button>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
