import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MessageSquareWarning } from "lucide-react";

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
import { marquerNudgeLu, nudgeNonLu } from "@/features/moteur/api";

/**
 * Le message interne envoyé depuis la file de surveillance.
 *
 * Il n'existe aucun canal vers les créateurs en dehors de l'OS : pas d'e-mail,
 * pas de SMS. Un nudge est donc un message qui attend le créateur à sa
 * prochaine connexion, et qui ne part qu'une fois qu'il a cliqué — sans quoi
 * on n'aurait aucun moyen de savoir s'il l'a seulement vu.
 *
 * Le plus ancien non lu d'abord : on relance dans l'ordre où on a parlé.
 */
export function NudgePopup() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: message, isPending } = useQuery({
    queryKey: ["nudge-non-lu"],
    queryFn: nudgeNonLu,
  });

  const marquer = useMutation({
    mutationFn: (id: string) => marquerNudgeLu(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nudge-non-lu"] }),
  });

  if (isPending || !message) return null;

  return (
    <Dialog open disablePointerDismissal>
      <DialogPopup showCloseButton={false} className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <MessageSquareWarning className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-base">{t("nudge.titre")}</DialogTitle>
              <DialogDescription>{message.titre}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogPanel>
          <p className="whitespace-pre-line text-sm">{message.corps}</p>
        </DialogPanel>
        <DialogFooter>
          <Button loading={marquer.isPending} onClick={() => marquer.mutate(message.id)}>
            {marquer.isPending ? t("common.saving") : t("nudge.compris")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
