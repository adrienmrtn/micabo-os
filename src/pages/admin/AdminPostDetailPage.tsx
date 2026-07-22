import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, ImageUp, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  lirePost,
  listerSlides,
  majTexteSlide,
  remplacerPhotoSlide,
  renettoyerSlide,
} from "@/features/moteur/api";
import type { PostSlide } from "@/features/moteur/types";

function estPropre(slide: PostSlide): boolean {
  return Boolean(slide.media_library?.storage_path?.startsWith("propre/"));
}

/** Un bloc slide : photo (nettoyée ou à texte), texte éditable, actions image. */
function SlideAdmin({ slide, postId }: { slide: PostSlide; postId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const inputFichier = React.useRef<HTMLInputElement>(null);
  const [texte, setTexte] = React.useState(slide.texte_overlay ?? "");

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["slides", postId] });
  const texteModifie = texte !== (slide.texte_overlay ?? "");

  const enregistrerTexte = useMutation({
    mutationFn: () => majTexteSlide(slide.id, texte),
    onSuccess: rafraichir,
  });
  const renettoyer = useMutation({
    mutationFn: () => renettoyerSlide(slide.id),
    onSuccess: rafraichir,
  });
  const remplacer = useMutation({
    mutationFn: (fichier: File) => remplacerPhotoSlide(slide.id, fichier),
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
            disabled={remplacer.isPending}
            onClick={() => inputFichier.current?.click()}
          >
            <ImageUp />
            {remplacer.isPending ? t("common.saving") : t("adminPost.remplacerPhoto")}
          </Button>
          <input
            ref={inputFichier}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              if (fichier) remplacer.mutate(fichier);
              e.target.value = "";
            }}
          />
        </div>

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
        <SlideAdmin key={slide.id} slide={slide} postId={id!} />
      ))}
    </div>
  );
}
