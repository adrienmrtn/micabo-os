import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, ImageUp, Sparkles, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  compteReferenceDuPost,
  lirePost,
  listerMedias,
  listerSlides,
  majMediaSlide,
  majTexteSlide,
  renettoyerSlide,
  retirerPhotoSlide,
} from "@/features/moteur/api";
import type { Media, PostSlide } from "@/features/moteur/types";

function estPropre(slide: PostSlide): boolean {
  return Boolean(slide.media_library?.storage_path?.startsWith("propre/"));
}

/** Grille de la bibliothèque du compte de référence, pour remplacer un visuel. */
function SelecteurBibliotheque({
  medias,
  onChoisir,
  onFermer,
}: {
  medias: Media[];
  onChoisir: (mediaId: string) => void;
  onFermer: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onFermer}
    >
      <div
        className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">{t("adminPost.choisirBiblio")}</p>
          <Button size="icon" variant="ghost" aria-label={t("common.cancel")} onClick={onFermer}>
            <X />
          </Button>
        </div>
        {medias.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("adminPost.biblioVide")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {medias.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChoisir(m.id)}
                className="group relative overflow-hidden rounded-md border transition hover:ring-2 hover:ring-primary"
              >
                <img src={m.url} alt="" className="aspect-square w-full object-cover" />
                {!m.storage_path.startsWith("propre/") && (
                  <span className="absolute inset-x-0 bottom-0 bg-warning/80 py-0.5 text-center text-[10px] text-warning-foreground">
                    {t("adminPost.texteRestant")}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Un bloc slide : photo (nettoyée ou à texte), texte éditable, actions image. */
function SlideAdmin({
  slide,
  postId,
  compteReferenceId,
}: {
  slide: PostSlide;
  postId: string;
  compteReferenceId: string | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [texte, setTexte] = React.useState(slide.texte_overlay ?? "");
  const [picker, setPicker] = React.useState(false);

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["slides", postId] });
  const texteModifie = texte !== (slide.texte_overlay ?? "");

  const bibliotheque = useQuery({
    queryKey: ["medias", compteReferenceId],
    queryFn: () => listerMedias(compteReferenceId ?? undefined),
    enabled: picker && Boolean(compteReferenceId),
  });

  const enregistrerTexte = useMutation({
    mutationFn: () => majTexteSlide(slide.id, texte),
    onSuccess: rafraichir,
  });
  const renettoyer = useMutation({
    mutationFn: () => renettoyerSlide(slide.id),
    onSuccess: rafraichir,
  });
  const remplacer = useMutation({
    mutationFn: (mediaId: string) => majMediaSlide(slide.id, mediaId),
    onSuccess: () => {
      setPicker(false);
      rafraichir();
    },
  });
  const retirer = useMutation({
    mutationFn: () => retirerPhotoSlide(slide.id),
    onSuccess: rafraichir,
  });

  const propre = estPropre(slide);
  const photoUrl = slide.media_library?.url ?? null;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t("posts.slide", { position: slide.position })}</span>
          {slide.position_sophia && <Badge>{t("posts.sophia")}</Badge>}
          {!propre && photoUrl && <Badge variant="warning">{t("adminPost.texteRestant")}</Badge>}
          {!photoUrl && <Badge variant="warning">{t("posts.photoManquante")}</Badge>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <figure className="space-y-1.5">
            <figcaption className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("posts.photoAPoster")}
            </figcaption>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className={cn(
                  "w-full rounded-lg border object-contain",
                  !propre && "border-2 border-warning/60",
                )}
              />
            ) : (
              <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-warning/50 bg-warning/5 text-xs text-warning">
                {t("posts.photoManquante")}
              </div>
            )}
          </figure>

          {slide.reference_url && (
            <figure className="space-y-1.5">
              <figcaption className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("posts.placementTitre")}
              </figcaption>
              <img src={slide.reference_url} alt="" className="w-full rounded-lg border object-contain" />
            </figure>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={renettoyer.isPending}
            onClick={() => renettoyer.mutate()}
          >
            <Sparkles />
            {renettoyer.isPending ? t("adminPost.nettoyageEnCours") : t("adminPost.renettoyer")}
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={remplacer.isPending || !compteReferenceId}
            onClick={() => setPicker(true)}
          >
            <ImageUp />
            {remplacer.isPending ? t("common.saving") : t("adminPost.remplacerPhoto")}
          </Button>

          {photoUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={retirer.isPending}
              onClick={() => {
                if (window.confirm(t("adminPost.confirmRetirerPhoto"))) retirer.mutate();
              }}
            >
              <Trash2 />
              {t("adminPost.retirerPhoto")}
            </Button>
          )}
        </div>

        {picker && (
          <SelecteurBibliotheque
            medias={bibliotheque.data ?? []}
            onChoisir={(mediaId) => remplacer.mutate(mediaId)}
            onFermer={() => setPicker(false)}
          />
        )}

        {renettoyer.data && !renettoyer.data.nettoyee && (
          <p className="text-xs text-destructive">
            {t("adminPost.nettoyageEchec")}
            {renettoyer.data.erreur ? ` — ${renettoyer.data.erreur}` : ""}
          </p>
        )}
        {renettoyer.data?.nettoyee && renettoyer.data.verifie_sans_texte === false && (
          <p className="text-xs text-warning">{t("adminPost.nettoyageTexteResiduel")}</p>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("posts.texteSlide")}
          </label>
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {texteModifie && (
            <div className="flex gap-2">
              <Button size="sm" disabled={enregistrerTexte.isPending} onClick={() => enregistrerTexte.mutate()}>
                <Check />
                {enregistrerTexte.isPending ? t("common.saving") : t("common.save")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setTexte(slide.texte_overlay ?? "")}>
                {t("common.cancel")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminPostDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const post = useQuery({ queryKey: ["post", id], queryFn: () => lirePost(id!), enabled: Boolean(id) });
  const slides = useQuery({
    queryKey: ["slides", id],
    queryFn: () => listerSlides(id!),
    enabled: Boolean(id),
  });
  // Compte de référence du post : sa bibliothèque alimente le remplacement.
  const refId = useQuery({
    queryKey: ["post-ref", id],
    queryFn: () => compteReferenceDuPost(id!),
    enabled: Boolean(id),
  });

  if (post.isPending || slides.isPending) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!post.data) return <p className="text-sm text-destructive">{t("common.notFoundTitle")}</p>;

  const liste = slides.data ?? [];
  const aProbleme = liste.filter((s) => !estPropre(s)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/calendrier">{t("common.back")}</Link>
        </Button>
        <div className="flex gap-1.5">
          <Badge variant="secondary">{t(`type.${post.data.type}`)}</Badge>
          <Badge variant={post.data.publie_at ? "success" : "outline"}>
            {t(`statut.${post.data.statut}`)}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("adminPost.title")}</CardTitle>
          <CardDescription>
            {aProbleme > 0
              ? t("adminPost.aVerifier", { count: aProbleme })
              : t("adminPost.toutPropre")}
          </CardDescription>
        </CardHeader>
      </Card>

      {liste.map((slide) => (
        <SlideAdmin
          key={slide.id}
          slide={slide}
          postId={id!}
          compteReferenceId={refId.data ?? null}
        />
      ))}
    </div>
  );
}
