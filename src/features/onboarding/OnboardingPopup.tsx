import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PlayCircle } from "lucide-react";

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
import { marquerOnboardingVu, onboardingVu } from "@/features/moteur/api";

/** Lien de partage Loom → lien d'intégration (iframe). */
const LOOM_EMBED = "https://www.loom.com/embed/56715ee66ffc42d0ab15f8a2a179c770";

/**
 * Pop-up de bienvenue : à sa PREMIÈRE connexion, le poster voit une vidéo qui
 * explique comment poster. « J'ai compris » la marque vue — le pop-up ne
 * réapparaît plus ensuite. Rien à montrer (déjà vue) → rien ne se monte.
 */
export function OnboardingPopup() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: vu, isPending } = useQuery({
    queryKey: ["onboarding-vu"],
    queryFn: onboardingVu,
  });

  const marquer = useMutation({
    mutationFn: marquerOnboardingVu,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-vu"] }),
  });

  if (isPending || vu) return null;

  return (
    <Dialog open disablePointerDismissal>
      <DialogPopup showCloseButton={false} className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <PlayCircle className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-base">{t("onboarding.titre")}</DialogTitle>
              <DialogDescription>{t("onboarding.sous")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogPanel>
          <div className="aspect-video w-full overflow-hidden rounded-xl border bg-black">
            <iframe
              src={LOOM_EMBED}
              title={t("onboarding.titre")}
              allowFullScreen
              className="size-full"
            />
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button loading={marquer.isPending} onClick={() => marquer.mutate()}>
            {marquer.isPending ? t("common.saving") : t("onboarding.compris")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
