import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl animate-fade-in rounded-2xl border bg-card p-6 shadow-lifted">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <PlayCircle className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">{t("onboarding.titre")}</h2>
            <p className="text-xs text-muted-foreground">{t("onboarding.sous")}</p>
          </div>
        </div>

        <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl border bg-black">
          <iframe
            src={LOOM_EMBED}
            title={t("onboarding.titre")}
            allowFullScreen
            className="size-full"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button disabled={marquer.isPending} onClick={() => marquer.mutate()}>
            {marquer.isPending ? t("common.saving") : t("onboarding.compris")}
          </Button>
        </div>
      </div>
    </div>
  );
}
