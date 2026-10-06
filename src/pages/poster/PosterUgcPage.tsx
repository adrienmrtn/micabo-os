import * as React from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Copy, Download, Music, Share, VolumeX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mesComptes } from "@/features/moteur/api";
import { verifierLienPublication } from "@/features/moteur/lienPublication";
import {
  partagerFichiers,
  peutPartager,
  recupererFichier,
  telechargerFichier,
} from "@/features/moteur/telechargement";
import {
  lirePublicationUgc,
  marquerPublicationUgc,
  nomFichierVideo,
} from "@/features/ugc/publications";
import { CarteQr, Loupe, TexteCopiable, Visuel } from "@/pages/poster/PosterPostPage";

/**
 * La vidéo du jour d'un compte AI UGC : une vidéo complète à poster telle
 * quelle (muette, le créateur pose un son dans TikTok), une démo quand la
 * source en a une, le texte à coller et l'endroit où le poser.
 */
export function PosterUgcPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [lienPublie, setLienPublie] = React.useState("");
  const [loupe, setLoupe] = React.useState<string | null>(null);
  const [erreurPartage, setErreurPartage] = React.useState<string | null>(null);

  const publication = useQuery({
    queryKey: ["publication-ugc", id],
    queryFn: () => lirePublicationUgc(id!),
    enabled: Boolean(id),
  });
  const { data: comptes } = useQuery({ queryKey: ["mes-comptes"], queryFn: mesComptes });

  const donnees = publication.data;
  const handle = comptes?.find((c) => c.id === donnees?.compte_id)?.handle_tiktok ?? null;

  // iOS exige que le partage parte du geste : les fichiers sont donc chargés
  // dès l'ouverture, jamais pendant le tap (voir `telechargement.ts`).
  const fichiers = useQuery({
    queryKey: ["publication-ugc-fichiers", id, donnees?.video_url, donnees?.demo_url],
    enabled: Boolean(donnees),
    queryFn: async () => {
      const video = await recupererFichier(
        donnees!.video_url,
        nomFichierVideo(handle, donnees!.date_publication_prevue, "video"),
      );
      const demo = donnees!.demo_url
        ? await recupererFichier(
            donnees!.demo_url,
            nomFichierVideo(handle, donnees!.date_publication_prevue, "demo"),
          )
        : null;
      return { video, demo };
    },
  });

  const verdictLien = verifierLienPublication(lienPublie);
  const lienTouche = lienPublie.trim().length > 0;

  const publier = useMutation({
    mutationFn: () => {
      if (!verdictLien.ok) throw new Error(t(`posts.lien_${verdictLien.motif}`));
      return marquerPublicationUgc(id!, verdictLien.url!);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["publication-ugc", id] });
      void queryClient.invalidateQueries({ queryKey: ["mes-publications-ugc"] });
    },
  });

  async function enregistrer(fichier: File | null | undefined) {
    setErreurPartage(null);
    if (!fichier) return;
    try {
      if (peutPartager([fichier])) {
        await partagerFichiers([fichier], fichier.name);
        return;
      }
      telechargerFichier(fichier, fichier.name);
    } catch (e) {
      setErreurPartage(e instanceof Error ? e.message : String(e));
    }
  }

  if (publication.isPending) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (publication.isError) {
    return (
      <p className="text-sm text-destructive">
        {(publication.error as Error | null)?.message ?? t("common.error")}
      </p>
    );
  }
  if (!donnees) {
    return <p className="text-sm text-destructive">{t("common.notFoundTitle")}</p>;
  }

  const publie = Boolean(donnees.publie_at);
  const partageMobile = peutPartager(fichiers.data ? [fichiers.data.video] : []);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {loupe && <Loupe url={loupe} onClose={() => setLoupe(null)} />}

      {/* 1 — La vidéo à poster, et l'enregistrer d'un geste. */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{t("ugcPoster.titre")}</span>
            <div className="flex gap-1.5">
              <Badge variant="secondary">{t("type.video")}</Badge>
              <Badge variant={publie ? "success" : "outline"}>
                {t(`statut.${donnees.statut}`)}
              </Badge>
            </div>
          </div>

          <video
            src={donnees.video_url}
            controls
            playsInline
            loop
            preload="metadata"
            className="mx-auto max-h-[70vh] w-full rounded-lg border bg-black object-contain"
          />

          <Button
            size="lg"
            className="w-full"
            disabled={fichiers.isFetching || !fichiers.data}
            onClick={() => enregistrer(fichiers.data?.video)}
          >
            {partageMobile ? <Share /> : <Download />}
            {fichiers.isFetching ? t("ugcPoster.preparation") : t("ugcPoster.enregistrerVideo")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("ugcPoster.enregistrerAide")}</p>
          <p className="flex items-start gap-1.5 rounded-md bg-muted/60 px-3 py-2 text-xs">
            <VolumeX className="mt-0.5 size-3.5 shrink-0" />
            {t("ugcPoster.sonAide")}
          </p>
          {fichiers.isError && (
            <p className="text-sm text-destructive">{(fichiers.error as Error).message}</p>
          )}
          {erreurPartage && <p className="text-sm text-destructive">{erreurPartage}</p>}
        </CardContent>
      </Card>

      {/* 2 — La démo de l'appli, quand la source en a une. */}
      {donnees.demo_url && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="text-sm font-medium">{t("ugcPoster.demo")}</p>
            <p className="text-xs text-muted-foreground">{t("ugcPoster.demoAide")}</p>
            <video
              src={donnees.demo_url}
              controls
              playsInline
              preload="metadata"
              className="mx-auto max-h-[60vh] w-full rounded-lg border bg-black object-contain"
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={fichiers.isFetching || !fichiers.data?.demo}
              onClick={() => enregistrer(fichiers.data?.demo)}
            >
              <Share />
              {t("ugcPoster.enregistrerDemo")}
            </Button>
          </CardContent>
        </Card>
      )}

      <CarteQr url={window.location.href} />

      {/* 3 — Le texte à poser sur la vidéo, et où le poser. */}
      {donnees.texte && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <TexteCopiable texte={donnees.texte} label={t("ugcPoster.texteTitre")} />
            <p className="text-xs text-muted-foreground">{t("ugcPoster.texteAide")}</p>
            {donnees.capture_url && (
              <Visuel
                url={donnees.capture_url}
                legende={t("ugcPoster.captureTitre")}
                onZoom={() => setLoupe(donnees.capture_url!)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* 4 — Le son, quand on en impose un. */}
      {donnees.musique_url && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-5">
            <Music className="size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t("posts.musique")}</p>
              <p className="text-xs text-muted-foreground">{t("posts.musiqueFavori")}</p>
            </div>
            <Button asChild className="shrink-0">
              <a href={donnees.musique_url} target="_blank" rel="noreferrer">
                {t("posts.ouvrirMusique")}
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 5 — La légende du post TikTok. */}
      {donnees.legende && (
        <Card>
          <CardContent className="pt-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t("posts.hashtagsTitre")}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard?.writeText(donnees.legende)}
              >
                <Copy className="size-3.5" />
                {t("posts.copier")}
              </Button>
            </div>
            <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-primary">
              {donnees.legende}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 6 — Publié : le lien du post TikTok. */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          {publie ? (
            <p className="text-sm text-success">
              {t("posts.publieLe", {
                date: new Date(donnees.publie_at!).toLocaleString(i18n.language),
              })}
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="lien">{t("posts.lienPublie")}</Label>
                <Input
                  id="lien"
                  type="url"
                  inputMode="url"
                  placeholder="https://www.tiktok.com/@..."
                  value={lienPublie}
                  onChange={(e) => setLienPublie(e.target.value)}
                  required
                />
                {lienTouche && !verdictLien.ok ? (
                  <p className="text-xs text-destructive">
                    {t(`posts.lien_${verdictLien.motif}`)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("posts.lienObligatoireAide")}</p>
                )}
              </div>
              {publier.isError && (
                <p className="text-sm text-destructive">
                  {publier.error instanceof Error ? publier.error.message : t("posts.lienObligatoire")}
                </p>
              )}
              <Button
                className="w-full"
                disabled={publier.isPending || !verdictLien.ok}
                onClick={() => publier.mutate()}
              >
                {publier.isPending ? t("common.saving") : t("posts.marquerPublie")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
