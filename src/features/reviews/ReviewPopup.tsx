import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MessageSquareQuote } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-fade-in rounded-2xl border bg-card p-6 shadow-lifted">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <MessageSquareQuote className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">{t("reviews.popupTitre")}</h2>
            <p className="text-xs text-muted-foreground">{t("reviews.popupSous")}</p>
          </div>
        </div>

        <p className="mt-4 whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
          {courante.body}
        </p>

        <Button
          className="mt-5 w-full"
          size="lg"
          disabled={marquer.isPending}
          onClick={() => marquer.mutate(courante.id)}
        >
          {marquer.isPending ? t("common.saving") : t("reviews.compris")}
        </Button>
      </div>
    </div>
  );
}
