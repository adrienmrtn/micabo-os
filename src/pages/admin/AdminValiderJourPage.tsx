import * as React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, RefreshCcw, SkipForward } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import {
  avancerUnPost,
  aujourdhuiParis,
  compteReferenceDuPost,
  lireReglages,
  listerSlides,
  revoquerPost,
} from "@/features/moteur/api";
import { SlideAdmin } from "@/features/moteur/SlideAdmin";
import { estPropre } from "@/features/moteur/slidePropre";
import { nomLangue } from "@/features/moteur/langues";
import { TikTokEmbed } from "@/features/reviews/TikTokEmbed";
import {
  listerFileValidationJour,
  marquerValideJour,
} from "@/features/validation/fileJourListe";
import type { ProviderNettoyage } from "@/features/moteur/nettoyageEtapes";

export function AdminValiderJourPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const jour = aujourdhuiParis();
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [revoq, setRevoq] = React.useState<string | null>(null);

  const file = useQuery({
    queryKey: ["validation-file-jour", jour],
    queryFn: () => listerFileValidationJour(jour),
  });
  const { data: reglages } = useQuery({
    queryKey: ["reglages"],
    queryFn: lireReglages,
    staleTime: 30_000,
  });
  const premier: ProviderNettoyage = reglages?.nettoyage.provider_principal ?? "fal";

  const liste = React.useMemo(() => file.data ?? [], [file.data]);
  const courant = liste.find((p) => p.postId === focusId) ?? liste[0] ?? null;
  const restants = liste.length;

  React.useEffect(() => {
    if (focusId && !liste.some((p) => p.postId === focusId)) setFocusId(null);
  }, [focusId, liste]);

  const slides = useQuery({
    queryKey: ["slides", courant?.postId],
    queryFn: () => listerSlides(courant!.postId),
    enabled: Boolean(courant?.postId),
  });
  const refId = useQuery({
    queryKey: ["post-ref", courant?.postId],
    queryFn: () => compteReferenceDuPost(courant!.postId),
    enabled: Boolean(courant?.postId),
  });

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: ["validation-file-jour", jour] });
    if (courant?.postId) {
      void queryClient.invalidateQueries({ queryKey: ["slides", courant.postId] });
    }
  };

  const valider = useMutation({
    mutationFn: () => {
      if (!courant) throw new Error("file vide");
      return marquerValideJour(courant.postId, jour);
    },
    onSuccess: () => {
      setFocusId(null);
      rafraichir();
    },
  });

  const passer = () => {
    if (!courant || liste.length < 2) return;
    const i = liste.findIndex((p) => p.postId === courant.postId);
    const next = liste[(i + 1) % liste.length];
    if (next) setFocusId(next.postId);
  };

  async function changerSlideshow() {
    if (!courant) return;
    if (!window.confirm(t("adminPost.confirmRevoquer"))) return;
    setRevoq(t("adminPost.revoquerEnCours"));
    try {
      const { newPostId } = await revoquerPost(courant.postId);
      if (!newPostId) {
        setRevoq(null);
        window.alert(t("adminPost.revoquerAucun"));
        rafraichir();
        return;
      }
      for (let i = 0; i < 40; i += 1) {
        const r = await avancerUnPost(newPostId).catch(() => null);
        if (!r || r.etape === "done" || r.etape === "failed") break;
      }
      setFocusId(newPostId);
      setRevoq(null);
      void queryClient.invalidateQueries({ queryKey: ["validation-file-jour", jour] });
      void queryClient.invalidateQueries({ queryKey: ["slides", newPostId] });
    } catch (e) {
      setRevoq(null);
      window.alert((e as Error).message);
    }
  }

  const aProbleme = (slides.data ?? []).filter((s) => !estPropre(s)).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("validerJour.title")}</CardTitle>
          <CardDescription>{t("validerJour.subtitle", { date: jour })}</CardDescription>
        </CardHeader>
        <CardContent>
          {file.isPending && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {file.isError && (
            <p className="text-sm text-destructive">{(file.error as Error).message}</p>
          )}
          {!file.isPending && restants === 0 && (
            <EmptyState title={t("validerJour.videTitre")} description={t("validerJour.videAide")} />
          )}
          {!file.isPending && restants > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("validerJour.restants", { count: restants })}
            </p>
          )}
        </CardContent>
      </Card>

      {courant && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base">
                  {courant.posterNom}
                  {courant.handle ? (
                    <span className="ml-2 font-normal text-muted-foreground">
                      @{courant.handle.replace(/^@/, "")}
                    </span>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  {courant.titre || t("reviewsJour.sansTitre")}
                  {courant.langue ? ` · ${nomLangue(courant.langue)}` : ""}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{t(`type.${courant.type}`)}</Badge>
                {courant.slideshowVide && (
                  <Badge variant="destructive">{t("adminCal.slideshowVide")}</Badge>
                )}
                {aProbleme > 0 && (
                  <Badge variant="warning">{t("adminPost.aVerifier", { count: aProbleme })}</Badge>
                )}
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/admin/posts/${courant.postId}`}>{t("adminCal.voirPost")}</Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={revoq !== null}
                onClick={() => void changerSlideshow()}
              >
                <RefreshCcw className="size-3.5" />
                {revoq ?? t("validerJour.changerSlideshow")}
              </Button>
              {liste.length > 1 && (
                <Button size="sm" variant="outline" onClick={passer}>
                  <SkipForward className="size-3.5" />
                  {t("validerJour.plusTard")}
                </Button>
              )}
              <Button
                size="sm"
                disabled={valider.isPending}
                onClick={() => valider.mutate()}
              >
                <Check className="size-3.5" />
                {valider.isPending ? t("common.saving") : t("validerJour.valider")}
              </Button>
            </div>

            <div className="flex flex-col gap-4 xl:flex-row">
              <div className="xl:sticky xl:top-4 xl:w-[min(100%,380px)] xl:shrink-0">
                <TikTokEmbed url={courant.sourceUrl} label={t("reviewsJour.origine")} />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                {slides.isPending && (
                  <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
                )}
                {(slides.data ?? []).map((slide) => (
                  <SlideAdmin
                    key={slide.id}
                    slide={slide}
                    postId={courant.postId}
                    compteReferenceId={refId.data ?? null}
                    contenuId={courant.contenuId}
                    premier={premier}
                    texteEnPlace
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
