import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Download, QrCode } from "lucide-react";
import JSZip from "jszip";
import QRCode from "qrcode";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  lirePost,
  listerSlides,
  majPost,
  reordonnerSlides,
} from "@/features/moteur/api";
import type { PostSlide } from "@/features/moteur/types";

function BoutonCopier({ texte }: { texte: string }) {
  const { t } = useTranslation();
  const [copie, setCopie] = React.useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(texte);
        setCopie(true);
        window.setTimeout(() => setCopie(false), 2000);
      }}
    >
      {copie ? t("posts.copie") : t("posts.copier")}
    </Button>
  );
}

/** QR pointant vers cette même page : le poster passe de l'ordi au téléphone. */
function CarteQr({ url }: { url: string }) {
  const { t } = useTranslation();
  const [image, setImage] = React.useState<string | null>(null);

  React.useEffect(() => {
    QRCode.toDataURL(url, { width: 220, margin: 1 })
      .then(setImage)
      .catch(() => setImage(null));
  }, [url]);

  if (!image) return null;

  return (
    <Card className="hidden sm:block">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="size-4" />
          {t("posts.qrTitle")}
        </CardTitle>
        <CardDescription>{t("posts.qrBody")}</CardDescription>
      </CardHeader>
      <CardContent>
        <img src={image} alt="QR code" className="rounded-lg border" />
      </CardContent>
    </Card>
  );
}

export function PosterPostPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [lienPublie, setLienPublie] = React.useState("");
  const [zipEnCours, setZipEnCours] = React.useState(false);

  const post = useQuery({
    queryKey: ["post", id],
    queryFn: () => lirePost(id!),
    enabled: Boolean(id),
  });
  const slides = useQuery({
    queryKey: ["slides", id],
    queryFn: () => listerSlides(id!),
    enabled: Boolean(id),
  });

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: ["post", id] });
    queryClient.invalidateQueries({ queryKey: ["slides", id] });
    queryClient.invalidateQueries({ queryKey: ["mes-posts"] });
  };

  const deplacer = useMutation({
    mutationFn: async (input: { index: number; delta: number }) => {
      const liste = [...(slides.data ?? [])];
      const cible = input.index + input.delta;
      if (cible < 0 || cible >= liste.length) return;
      [liste[input.index], liste[cible]] = [liste[cible], liste[input.index]];
      await reordonnerSlides(liste);
    },
    onSuccess: rafraichir,
  });

  const valider = useMutation({
    mutationFn: () => majPost(id!, { statut: "valide_par_poster" }),
    onSuccess: rafraichir,
  });

  const publier = useMutation({
    mutationFn: () =>
      majPost(id!, {
        statut: "publie",
        publie_at: new Date().toISOString(),
        publie_url: lienPublie.trim() || null,
      }),
    onSuccess: rafraichir,
  });

  /** Récupère les visuels et les textes en une archive, prête pour TikTok. */
  async function telechargerTout(liste: PostSlide[]) {
    setZipEnCours(true);
    try {
      const zip = new JSZip();
      const textes: string[] = [];

      for (const slide of liste) {
        const url = slide.media_library?.url;
        if (url) {
          const reponse = await fetch(url);
          zip.file(`${slide.position}.jpg`, await reponse.blob());
        }
        if (slide.texte_overlay) {
          textes.push(`Slide ${slide.position}\n${slide.texte_overlay}\n`);
        }
      }

      if (post.data?.musique_url) {
        textes.push(`\nMusique : ${post.data.musique_url}`);
      }
      zip.file("textes.txt", textes.join("\n"));

      const blob = await zip.generateAsync({ type: "blob" });
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(blob);
      lien.download = `post-${id}.zip`;
      lien.click();
      URL.revokeObjectURL(lien.href);
    } finally {
      setZipEnCours(false);
    }
  }

  if (post.isPending || slides.isPending) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!post.data) {
    return <p className="text-sm text-destructive">{t("common.notFoundTitle")}</p>;
  }

  const liste = slides.data ?? [];
  const publie = Boolean(post.data.publie_at);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link to="/calendrier">{t("common.back")}</Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{t("posts.title")}</CardTitle>
            <div className="flex gap-1.5">
              <Badge variant="secondary">{t(`type.${post.data.type}`)}</Badge>
              <Badge variant={publie ? "success" : "outline"}>
                {t(`statut.${post.data.statut}`)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            disabled={zipEnCours || liste.length === 0}
            onClick={() => telechargerTout(liste)}
          >
            <Download />
            {zipEnCours ? t("common.saving") : t("posts.telechargerTout")}
          </Button>

          {post.data.musique_url && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("posts.musique")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={post.data.musique_url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-sm underline underline-offset-4"
                >
                  {post.data.musique_titre ?? post.data.musique_url}
                </a>
                <BoutonCopier texte={post.data.musique_url} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CarteQr url={window.location.href} />

      <div className="space-y-4">
        {liste.map((slide, index) => (
          <Card key={slide.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {t("posts.slide", { position: slide.position })}
                  {slide.position_sophia && <Badge>{t("posts.sophia")}</Badge>}
                </span>
                {!publie && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("posts.monterSlide")}
                      disabled={index === 0 || deplacer.isPending}
                      onClick={() => deplacer.mutate({ index, delta: -1 })}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("posts.descendreSlide")}
                      disabled={index === liste.length - 1 || deplacer.isPending}
                      onClick={() => deplacer.mutate({ index, delta: 1 })}
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                )}
              </div>

              {slide.media_library?.url && (
                <>
                  <img
                    src={slide.media_library.url}
                    alt=""
                    className="w-full rounded-md border object-contain"
                  />
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <a href={slide.media_library.url} download target="_blank" rel="noreferrer">
                      {t("posts.telecharger")}
                    </a>
                  </Button>
                </>
              )}

              {slide.texte_overlay && (
                <div className="space-y-2">
                  <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
                    {slide.texte_overlay}
                  </p>
                  <BoutonCopier texte={slide.texte_overlay} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3 pt-5">
          {publie ? (
            <p className="text-sm text-success">
              {t("posts.publieLe", {
                date: new Date(post.data.publie_at!).toLocaleString(i18n.language),
              })}
            </p>
          ) : (
            <>
              {post.data.statut !== "valide_par_poster" && (
                <Button
                  variant="outline"
                  disabled={valider.isPending}
                  onClick={() => valider.mutate()}
                >
                  {t("posts.valider")}
                </Button>
              )}

              <div className="space-y-2">
                <Label htmlFor="lien">{t("posts.lienPublie")}</Label>
                <Input
                  id="lien"
                  type="url"
                  placeholder="https://www.tiktok.com/@..."
                  value={lienPublie}
                  onChange={(e) => setLienPublie(e.target.value)}
                />
              </div>

              <Button disabled={publier.isPending} onClick={() => publier.mutate()}>
                {publier.isPending ? t("common.saving") : t("posts.marquerPublie")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
