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

/**
 * Pop-up de review pour le poster : à sa connexion, s'il a une (ou plusieurs)
 * review non vue, elle s'affiche par-dessus tout. « Compris » la marque vue et
 * enchaîne sur la suivante s'il y en a. Rien à afficher → rien ne se monte.
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
  if (!courante) return null;

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
        <DialogPanel>
          <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
            {courante.body}
          </p>
        </DialogPanel>
        <DialogFooter>
          <Button
            className="w-full sm:w-auto"
            size="lg"
            loading={marquer.isPending}
            onClick={() => marquer.mutate(courante.id)}
          >
            {marquer.isPending ? t("common.saving") : t("reviews.compris")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
