import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pencil, Send, SkipForward, Sparkles, Trash2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  aujourdhuiParis,
  ameliorerReview,
  ecrireReglage,
  envoyerReviewPost,
  lireRemarquesReviewJour,
  listerFileReviewsJour,
  passerFileJour,
} from "@/features/moteur/api";
import { TikTokEmbed } from "@/features/reviews/TikTokEmbed";
import {
  CLE_REMARQUES,
  collerRemarque,
  CORPS_MAX,
  normaliserRemarques,
  REMARQUES_MAX,
  TITRE_MAX,
  type RemarqueGenerique,
} from "@/features/reviews/fileQuotidienne";

export function AdminReviewsJourPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const jour = aujourdhuiParis();
  const [texte, setTexte] = React.useState("");
  const [reglagesOuverts, setReglagesOuverts] = React.useState(false);
  const [brouillonRemarques, setBrouillonRemarques] = React.useState<
    RemarqueGenerique[] | null
  >(null);
  const [nouveauTitre, setNouveauTitre] = React.useState("");
  const [nouveauCorps, setNouveauCorps] = React.useState("");

  const file = useQuery({
    queryKey: ["reviews-file-jour", jour],
    queryFn: () => listerFileReviewsJour(jour),
  });
  const remarquesQ = useQuery({
    queryKey: ["reviews-remarques"],
    queryFn: lireRemarquesReviewJour,
  });

  const courant = (file.data ?? [])[0];
  const restants = file.data?.length ?? 0;

  React.useEffect(() => {
    setTexte("");
  }, [courant?.postId]);

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: ["reviews-file-jour", jour] });
    void queryClient.invalidateQueries({ queryKey: ["reviews"] });
  };

  const envoyer = useMutation({
    mutationFn: () => {
      if (!courant) throw new Error("file vide");
      return envoyerReviewPost({
        posterId: courant.posterId,
        postId: courant.postId,
        passageId: courant.passageId,
        body: texte,
        publieUrl: courant.publieUrl,
        sourceUrl: courant.sourceUrl,
        handleTiktok: courant.handle,
      });
    },
    onSuccess: () => {
      setTexte("");
      rafraichir();
    },
  });

  const passer = useMutation({
    mutationFn: () => {
      if (!courant) throw new Error("file vide");
      return passerFileJour(courant.postId, jour);
    },
    onSuccess: () => {
      setTexte("");
      rafraichir();
    },
  });

  const ameliorer = useMutation({
    mutationFn: () => ameliorerReview(texte),
    onSuccess: (out) => setTexte(out),
  });

  const sauverRemarques = useMutation({
    mutationFn: (liste: RemarqueGenerique[]) => ecrireReglage(CLE_REMARQUES, liste),
    onSuccess: () => {
      setBrouillonRemarques(null);
      setNouveauTitre("");
      setNouveauCorps("");
      void queryClient.invalidateQueries({ queryKey: ["reviews-remarques"] });
    },
  });

  const puces = brouillonRemarques ?? remarquesQ.data ?? [];
  const edition = brouillonRemarques !== null;
  const occupé = envoyer.isPending || passer.isPending;
  const dateLabel = new Date(`${jour}T12:00:00`).toLocaleDateString(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("reviewsJour.title")}</CardTitle>
          <CardDescription>{t("reviewsJour.subtitle", { date: dateLabel })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant={restants ? "secondary" : "outline"}>
            {t("reviewsJour.restants", { count: restants })}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => setReglagesOuverts((v) => !v)}
          >
            <Pencil className="size-3.5" />
            {t("reviewsJour.reglages")}
          </Button>
        </CardContent>
      </Card>

      {reglagesOuverts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reviewsJour.remarquesTitre")}</CardTitle>
            <CardDescription>{t("reviewsJour.remarquesAide")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(edition ? puces : (remarquesQ.data ?? [])).map((r, i) => (
              <div key={`${i}-${r.titre}`} className="flex gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Input
                    value={r.titre}
                    maxLength={TITRE_MAX}
                    disabled={!edition || sauverRemarques.isPending}
                    placeholder={t("reviewsJour.remarqueTitre")}
                    onChange={(e) => {
                      const suite = [...puces];
                      suite[i] = { ...suite[i], titre: e.target.value };
                      setBrouillonRemarques(suite);
                    }}
                  />
                  <Textarea
                    value={r.corps}
                    maxLength={CORPS_MAX}
                    rows={2}
                    disabled={!edition || sauverRemarques.isPending}
                    placeholder={t("reviewsJour.remarqueCorps")}
                    onChange={(e) => {
                      const suite = [...puces];
                      suite[i] = { ...suite[i], corps: e.target.value };
                      setBrouillonRemarques(suite);
                    }}
                  />
                </div>
                {edition && (
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={sauverRemarques.isPending}
                    onClick={() => setBrouillonRemarques(puces.filter((_, j) => j !== i))}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {edition && puces.length < REMARQUES_MAX && (
              <div className="space-y-1.5">
                <Input
                  value={nouveauTitre}
                  maxLength={TITRE_MAX}
                  placeholder={t("reviewsJour.remarqueTitre")}
                  onChange={(e) => setNouveauTitre(e.target.value)}
                />
                <div className="flex gap-2">
                  <Textarea
                    value={nouveauCorps}
                    maxLength={CORPS_MAX}
                    rows={2}
                    placeholder={t("reviewsJour.remarqueCorps")}
                    onChange={(e) => setNouveauCorps(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    className="self-end"
                    disabled={!nouveauTitre.trim() && !nouveauCorps.trim()}
                    onClick={() => {
                      const titre = nouveauTitre.trim();
                      const corps = nouveauCorps.trim() || titre;
                      if (!titre && !corps) return;
                      setBrouillonRemarques([
                        ...puces,
                        { titre: titre || corps.slice(0, TITRE_MAX), corps },
                      ]);
                      setNouveauTitre("");
                      setNouveauCorps("");
                    }}
                  >
                    {t("reviewsJour.ajouter")}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {edition ? (
                <>
                  <Button
                    disabled={sauverRemarques.isPending}
                    onClick={() => sauverRemarques.mutate(normaliserRemarques(puces))}
                  >
                    {sauverRemarques.isPending ? t("common.saving") : t("common.save")}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={sauverRemarques.isPending}
                    onClick={() => {
                      setBrouillonRemarques(null);
                      setNouveauTitre("");
                      setNouveauCorps("");
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setBrouillonRemarques([...(remarquesQ.data ?? [])])}
                >
                  {t("common.edit")}
                </Button>
              )}
            </div>
            {sauverRemarques.isError && (
              <p className="text-sm text-destructive">
                {(sauverRemarques.error as Error).message}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {file.isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {file.isError && (
        <p className="text-sm text-destructive">{(file.error as Error).message}</p>
      )}
      {!file.isPending && restants === 0 && (
        <EmptyState
          title={t("reviewsJour.videTitre")}
          description={t("reviewsJour.videAide")}
        />
      )}

      {courant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {courant.posterNom}
              {courant.handle ? (
                <span className="ml-2 font-normal text-muted-foreground">@{courant.handle}</span>
              ) : null}
            </CardTitle>
            <CardDescription>
              {courant.titre || t("reviewsJour.sansTitre")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row">
              <TikTokEmbed url={courant.sourceUrl} label={t("reviewsJour.origine")} />
              <TikTokEmbed url={courant.publieUrl} label={t("reviewsJour.poste")} />
            </div>

            {(remarquesQ.data ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(remarquesQ.data ?? []).map((r) => (
                  <Button
                    key={r.titre}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    title={r.corps}
                    onClick={() => setTexte((a) => collerRemarque(a, r.corps))}
                  >
                    {r.titre}
                  </Button>
                ))}
              </div>
            )}

            <Textarea
              value={texte}
              rows={6}
              onChange={(e) => setTexte(e.target.value)}
              placeholder={t("reviewsJour.placeholder")}
              aria-label={t("reviewsJour.placeholder")}
            />
            {ameliorer.isError && (
              <p className="text-sm text-destructive">{(ameliorer.error as Error).message}</p>
            )}
            {envoyer.isError && (
              <p className="text-sm text-destructive">{(envoyer.error as Error).message}</p>
            )}
            {passer.isError && (
              <p className="text-sm text-destructive">{(passer.error as Error).message}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={occupé || ameliorer.isPending || !texte.trim()}
                onClick={() => ameliorer.mutate()}
              >
                <Sparkles className="size-4" />
                {ameliorer.isPending ? t("reviewsJour.ameliorationEnCours") : t("reviewsJour.ameliorer")}
              </Button>
              <Button variant="ghost" disabled={occupé} onClick={() => passer.mutate()}>
                <SkipForward className="size-4" />
                {t("reviewsJour.passer")}
              </Button>
              <Button
                className="ml-auto"
                disabled={occupé || !texte.trim()}
                onClick={() => envoyer.mutate()}
              >
                <Send className="size-4" />
                {envoyer.isPending ? t("common.saving") : t("reviewsJour.envoyer")}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">{t("reviewsJour.ameliorerAide")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
