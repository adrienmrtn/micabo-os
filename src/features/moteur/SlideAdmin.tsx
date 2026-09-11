import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, ImageUp, Sparkles, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NettoyageEtapes } from "@/components/moteur/NettoyageEtapes";
import { UpscaleMediaControl } from "@/components/moteur/UpscaleMediaControl";
import {
  listerMedias,
  listerMediasPourContenu,
  majMediaSlide,
  majTexteSlide,
  renettoyerSlide,
  retirerPhotoSlide,
  supprimerSlide,
} from "@/features/moteur/api";
import {
  appliquerEvenement,
  etapesInitiales,
  type EvenementEtape,
  type ProviderNettoyage,
} from "@/features/moteur/nettoyageEtapes";
import { cn } from "@/lib/utils";
import type { Media, PostSlide } from "@/features/moteur/types";
import { estPropre } from "@/features/moteur/slidePropre";

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
export function SlideAdmin({
  slide,
  postId,
  compteReferenceId,
  contenuId = null,
  premier,
  etapesLot,
  texteEnPlace = false,
}: {
  slide: PostSlide;
  postId: string;
  compteReferenceId: string | null;
  /** Slideshow v-next : ouvre la biblio labels + source, même si le poster n'a pas de compte_reference. */
  contenuId?: string | null;
  premier: ProviderNettoyage;
  /** Timeline fournie par un nettoyage en lot (sinon locale). */
  etapesLot?: EvenementEtape[] | null;
  /** Aperçu 9:16 avec le texte overlay (validation du jour). */
  texteEnPlace?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [texte, setTexte] = React.useState(slide.texte_overlay ?? "");
  const [picker, setPicker] = React.useState(false);
  const [etapesLocales, setEtapesLocales] = React.useState<EvenementEtape[] | null>(null);

  React.useEffect(() => {
    setTexte(slide.texte_overlay ?? "");
  }, [slide.id, slide.texte_overlay]);

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: ["slides", postId] });
    void queryClient.invalidateQueries({ queryKey: ["medias"] });
    void queryClient.invalidateQueries({ queryKey: ["medias-biblio"] });
    void queryClient.invalidateQueries({ queryKey: ["medias-remplacement"] });
  };
  const texteModifie = texte !== (slide.texte_overlay ?? "");
  const etapes = etapesLocales ?? etapesLot ?? null;
  const dejaUpscale = Boolean(slide.media_library?.upscale_le);

  const bibliotheque = useQuery({
    queryKey: ["medias-remplacement", contenuId, compteReferenceId],
    queryFn: () =>
      contenuId
        ? listerMediasPourContenu(contenuId)
        : listerMedias(compteReferenceId ?? undefined),
    enabled: picker,
  });

  const enregistrerTexte = useMutation({
    mutationFn: () => majTexteSlide(slide.id, texte),
    onSuccess: rafraichir,
  });
  const renettoyer = useMutation({
    mutationFn: () => {
      setEtapesLocales(etapesInitiales(premier));
      return renettoyerSlide(slide.id, (ev) => {
        setEtapesLocales((prev) =>
          appliquerEvenement(prev ?? etapesInitiales(premier), ev, premier),
        );
      });
    },
    onSuccess: () => {
      setEtapesLocales(null);
      rafraichir();
    },
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
  const supprimer = useMutation({
    mutationFn: () => supprimerSlide(slide.id),
    onSuccess: rafraichir,
  });

  const propre = estPropre(slide);
  const photoUrl = slide.media_library?.url ?? null;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{t("posts.slide", { position: slide.position })}</span>
          {slide.position_sophia && <Badge>{t("posts.sophia")}</Badge>}
          {!propre && photoUrl && <Badge variant="warning">{t("adminPost.texteRestant")}</Badge>}
          {!photoUrl && <Badge variant="warning">{t("posts.photoManquante")}</Badge>}
          {dejaUpscale && <Badge variant="success">{t("bibliotheque.dejaUpscale")}</Badge>}
        </div>

        <div className={cn("grid gap-3", !texteEnPlace && slide.reference_url && "sm:grid-cols-2")}>
          <figure className="space-y-1.5">
            <figcaption className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {texteEnPlace ? t("validerJour.apercu") : t("posts.photoAPoster")}
            </figcaption>
            {photoUrl ? (
              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-black",
                  texteEnPlace && "aspect-[9/16]",
                  !propre && "border-2 border-warning/60",
                )}
              >
                <img
                  src={photoUrl}
                  alt=""
                  className={
                    texteEnPlace
                      ? "absolute inset-0 h-full w-full object-cover"
                      : "w-full object-contain"
                  }
                />
                {texteEnPlace && texte.trim() ? (
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-[7%] text-center",
                      slide.position_sophia ? "bottom-[16%]" : "top-[15%]",
                    )}
                  >
                    <p
                      className="whitespace-pre-wrap font-bold leading-[1.15] text-white"
                      style={{
                        fontSize: "clamp(0.95rem, 4.4vw, 1.7rem)",
                        textShadow:
                          "0 0 4px #000, 0 1px 8px #000, 1px 1px 0 #000, -1px -1px 0 #000",
                      }}
                    >
                      {texte}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-warning/50 bg-warning/5 text-xs text-warning">
                {t("posts.photoManquante")}
              </div>
            )}
          </figure>

          {!texteEnPlace && slide.reference_url && (
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
            disabled={renettoyer.isPending || Boolean(etapesLot)}
            onClick={() => renettoyer.mutate()}
          >
            <Sparkles />
            {renettoyer.isPending || etapesLot
              ? t("adminPost.nettoyageEnCours")
              : t("adminPost.renettoyer")}
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={remplacer.isPending}
            onClick={() => setPicker(true)}
          >
            <ImageUp />
            {remplacer.isPending ? t("common.saving") : t("adminPost.remplacerPhoto")}
          </Button>

          {slide.media_id && (
            <UpscaleMediaControl
              mediaId={slide.media_id}
              dejaUpscale={dejaUpscale}
              disabled={Boolean(etapesLot) || renettoyer.isPending}
              onSuccess={rafraichir}
            />
          )}

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

          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={supprimer.isPending}
            onClick={() => {
              if (window.confirm(t("adminPost.confirmSupprimerSlide"))) supprimer.mutate();
            }}
          >
            <Trash2 />
            {t("adminPost.supprimerSlide")}
          </Button>
        </div>

        {etapes && (renettoyer.isPending || renettoyer.isError || etapesLot) ? (
          <NettoyageEtapes etapes={etapes} className="rounded border bg-muted/30 p-2" />
        ) : null}

        {picker && (
          <SelecteurBibliotheque
            medias={bibliotheque.data ?? []}
            onChoisir={(mediaId) => remplacer.mutate(mediaId)}
            onFermer={() => setPicker(false)}
          />
        )}

        {renettoyer.data?.remplacee && (
          <p className="text-xs text-warning">{t("adminPost.photoRemplacee")}</p>
        )}
        {renettoyer.data && !renettoyer.data.nettoyee && !renettoyer.data.remplacee && (
          <p className="text-xs text-destructive">
            {t("adminPost.nettoyageEchec")}
            {renettoyer.data.motif ? ` — ${renettoyer.data.motif}` : ""}
          </p>
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
