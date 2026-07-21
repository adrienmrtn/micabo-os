import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  Eye,
  Music,
  QrCode,
  Share,
  X,
} from "lucide-react";
import JSZip from "jszip";
import QRCode from "qrcode";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { lirePost, listerSlides, majPost, reordonnerSlides } from "@/features/moteur/api";
import {
  partagerFichiers,
  peutPartager,
  recupererFichier,
  telechargerFichier,
} from "@/features/moteur/telechargement";
import type { Post, PostSlide } from "@/features/moteur/types";

function nomFichier(postId: string, position: number) {
  return `${postId.slice(0, 8)}-${String(position).padStart(2, "0")}.jpg`;
}

/** Zone de texte entièrement tapable : sur mobile, viser un petit bouton est
 * pénible, et la sélection manuelle d'un texte multiligne encore plus. */
function TexteCopiable({ texte, label }: { texte: string; label?: string }) {
  const { t } = useTranslation();
  const [copie, setCopie] = React.useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      // Clipboard refusé (contexte non sécurisé) : le texte reste sélectionnable.
    }
  }

  return (
    <button
      type="button"
      onClick={copier}
      className="w-full rounded-lg border bg-muted/60 p-4 text-left transition active:scale-[0.99]"
    >
      {label && (
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      )}
      <span className="block whitespace-pre-wrap break-words text-base leading-relaxed">
        {texte}
      </span>
      <span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
        {copie ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copie ? t("posts.copie") : t("posts.taperPourCopier")}
      </span>
    </button>
  );
}

/** Plein écran : le placement du texte se juge sur une image lisible. */
function Loupe({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useTranslation();

  React.useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3"
      onClick={onClose}
    >
      <Button
        size="icon"
        variant="secondary"
        aria-label={t("common.cancel")}
        className="absolute right-3 top-3"
        onClick={onClose}
      >
        <X />
      </Button>
      <img src={url} alt="" className="max-h-full max-w-full object-contain" />
    </div>
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
  const [loupe, setLoupe] = React.useState<string | null>(null);
  const [erreurPartage, setErreurPartage] = React.useState<string | null>(null);
  const [enCours, setEnCours] = React.useState(false);

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

  const liste = React.useMemo(() => slides.data ?? [], [slides.data]);

  // Préchargement des visuels : `navigator.share` doit être appelé dans la
  // foulée du tap, il ne peut pas attendre un fetch.
  const fichiers = useQuery({
    queryKey: ["fichiers", id, liste.map((s) => s.media_library?.url).join("|")],
    enabled: liste.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const resultats: File[] = [];
      for (const slide of liste) {
        const url = slide.media_library?.url;
        if (url) resultats.push(await recupererFichier(url, nomFichier(id!, slide.position)));
      }
      return resultats;
    },
  });

  const rafraichir = () => {
    queryClient.invalidateQueries({ queryKey: ["post", id] });
    queryClient.invalidateQueries({ queryKey: ["slides", id] });
    queryClient.invalidateQueries({ queryKey: ["mes-posts"] });
  };

  const deplacer = useMutation({
    mutationFn: async (input: { index: number; delta: number }) => {
      const ordre = [...liste];
      const cible = input.index + input.delta;
      if (cible < 0 || cible >= ordre.length) return;
      [ordre[input.index], ordre[cible]] = [ordre[cible], ordre[input.index]];
      await reordonnerSlides(ordre);
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

  /** Tout d'un coup : feuille de partage sur mobile, ZIP sur ordinateur. */
  async function toutEnregistrer(donnees: Post) {
    setErreurPartage(null);
    const prets = fichiers.data ?? [];

    try {
      if (peutPartager(prets)) {
        await partagerFichiers(prets, t("posts.title"));
        return;
      }

      setEnCours(true);
      const zip = new JSZip();
      prets.forEach((f) => zip.file(f.name, f));
      zip.file("textes.txt", texteComplet(donnees, liste));
      telechargerFichier(await zip.generateAsync({ type: "blob" }), `post-${id}.zip`);
    } catch (e) {
      setErreurPartage(e instanceof Error ? e.message : String(e));
    } finally {
      setEnCours(false);
    }
  }

  /** Une seule photo : même logique, à l'échelle de la slide. */
  async function enregistrerUne(slide: PostSlide) {
    setErreurPartage(null);
    const nom = nomFichier(id!, slide.position);
    const dejaPret = (fichiers.data ?? []).find((f) => f.name === nom);

    try {
      const fichier = dejaPret ?? (await recupererFichier(slide.media_library!.url, nom));
      if (peutPartager([fichier])) {
        await partagerFichiers([fichier], nom);
        return;
      }
      telechargerFichier(fichier, nom);
    } catch (e) {
      setErreurPartage(e instanceof Error ? e.message : String(e));
    }
  }

  if (post.isPending || slides.isPending) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!post.data) {
    return <p className="text-sm text-destructive">{t("common.notFoundTitle")}</p>;
  }

  const donnees = post.data;
  const publie = Boolean(donnees.publie_at);
  const tousLesTextes = texteComplet(donnees, liste);
  // Recyclé et remanié rejouent un TikTok existant : le poster doit voir
  // l'original sans avoir à le déplier.
  const reprise = donnees.type === "recycle" || donnees.type === "remanie";

  return (
    <div className="space-y-6 pb-10">
      {loupe && <Loupe url={loupe} onClose={() => setLoupe(null)} />}

      <Button variant="outline" size="sm" asChild>
        <Link to="/calendrier">{t("common.back")}</Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{t("posts.title")}</CardTitle>
            <div className="flex gap-1.5">
              <Badge variant="secondary">{t(`type.${donnees.type}`)}</Badge>
              <Badge variant={publie ? "success" : "outline"}>
                {t(`statut.${donnees.statut}`)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            size="lg"
            className="w-full"
            disabled={enCours || fichiers.isPending || (fichiers.data ?? []).length === 0}
            onClick={() => toutEnregistrer(donnees)}
          >
            {peutPartager(fichiers.data ?? []) ? <Share /> : <Download />}
            {fichiers.isPending
              ? t("posts.preparation")
              : t("posts.enregistrerPhotos", { count: (fichiers.data ?? []).length })}
          </Button>
          <p className="text-xs text-muted-foreground">{t("posts.enregistrerAide")}</p>

          {fichiers.isError && (
            <p className="text-sm text-destructive">{(fichiers.error as Error).message}</p>
          )}
          {erreurPartage && <p className="text-sm text-destructive">{erreurPartage}</p>}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigator.clipboard.writeText(tousLesTextes)}
          >
            <Copy />
            {t("posts.copierTout")}
          </Button>
        </CardContent>
      </Card>

      {donnees.musique_url && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="size-4" />
              {t("posts.musique")}
            </CardTitle>
            <CardDescription>{donnees.musique_titre ?? donnees.musique_url}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild size="lg" className="w-full">
              <a href={donnees.musique_url} target="_blank" rel="noreferrer">
                {t("posts.ouvrirMusique")}
              </a>
            </Button>
            <TexteCopiable texte={donnees.musique_url} label={t("posts.lienMusique")} />
          </CardContent>
        </Card>
      )}

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
                    className="w-full rounded-lg border object-contain"
                    onClick={() => setLoupe(slide.media_library!.url)}
                  />
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full"
                    onClick={() => enregistrerUne(slide)}
                  >
                    <Share />
                    {t("posts.enregistrerPhoto")}
                  </Button>
                </>
              )}

              {slide.texte_overlay && (
                <TexteCopiable texte={slide.texte_overlay} label={t("posts.texteSlide")} />
              )}

              {/* Le visuel d'origine porte encore son texte : c'est le modèle de
                  placement à reproduire dans l'éditeur TikTok. Sur un post qui
                  reprend un TikTok existant il est indispensable, donc affiché
                  d'emblée sous le texte ; sur un post inédit il n'est qu'une
                  référence de style, et reste replié. */}
              {slide.reference_url &&
                (reprise ? (
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Eye className="size-3.5" />
                      {t("posts.placementTitre")}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("posts.placementAide")}</p>
                    <img
                      src={slide.reference_url}
                      alt=""
                      className="w-full rounded-md border object-contain"
                      onClick={() => setLoupe(slide.reference_url!)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setLoupe(slide.reference_url!)}
                    >
                      {t("posts.agrandir")}
                    </Button>
                  </div>
                ) : (
                  <details className="rounded-lg border">
                    <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-medium">
                      <Eye className="size-4" />
                      {t("posts.voirPlacement")}
                    </summary>
                    <div className="space-y-2 border-t p-3">
                      <p className="text-xs text-muted-foreground">{t("posts.placementAide")}</p>
                      <img
                        src={slide.reference_url}
                        alt=""
                        className="w-full rounded-md border object-contain"
                        onClick={() => setLoupe(slide.reference_url!)}
                      />
                    </div>
                  </details>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>

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
              {donnees.statut !== "valide_par_poster" && (
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
                  inputMode="url"
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

function texteComplet(post: Post, slides: PostSlide[]): string {
  const lignes = slides
    .filter((s) => s.texte_overlay)
    .map((s) => `Slide ${s.position}\n${s.texte_overlay}`);
  if (post.musique_url) lignes.push(`Musique : ${post.musique_url}`);
  return lignes.join("\n\n");
}
