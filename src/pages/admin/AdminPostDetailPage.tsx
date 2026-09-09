import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { QrCode, RefreshCcw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { executerEnLot } from "@/lib/lot";
import {
  apercuSujet,
  avancerUnPost,
  compteReferenceDuPost,
  lancerPreparation,
  lirePost,
  lireReglages,
  listerSlides,
  renettoyerSlide,
  revoquerPost,
} from "@/features/moteur/api";
import { SlideAdmin } from "@/features/moteur/SlideAdmin";
import { estPropre } from "@/features/moteur/slidePropre";
import {
  appliquerEvenement,
  etapesInitiales,
  type EvenementEtape,
  type ProviderNettoyage,
} from "@/features/moteur/nettoyageEtapes";
import { supabase } from "@/lib/supabase/client";

export function AdminPostDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lot, setLot] = React.useState<{ fait: number; total: number } | null>(null);
  const [etapesLot, setEtapesLot] = React.useState<Record<string, EvenementEtape[]>>({});
  const [revoq, setRevoq] = React.useState<string | null>(null);

  const { data: reglages } = useQuery({
    queryKey: ["reglages"],
    queryFn: lireReglages,
    staleTime: 30_000,
  });
  const premier: ProviderNettoyage = reglages?.nettoyage.provider_principal ?? "fal";

  /**
   * Post inutilisable (thème incohérent pour Sophia) : on rejette CE slideshow
   * (pas le hook — un autre post peut commencer pareil et rester bon), on en
   * refabrique un autre pour le même créateur + date, puis on l'ouvre.
   */
  async function revoquerEtRefaire() {
    if (!id) return;
    if (!window.confirm(t("adminPost.confirmRevoquer"))) return;
    setRevoq(t("adminPost.revoquerEnCours"));
    try {
      const { newPostId } = await revoquerPost(id);
      if (!newPostId) {
        setRevoq(null);
        window.alert(t("adminPost.revoquerAucun"));
        navigate("/admin/calendrier");
        return;
      }
      // v-next : déjà pipeline done. Legacy : on avance jusqu'à prêt.
      for (let i = 0; i < 40; i += 1) {
        const r = await avancerUnPost(newPostId).catch(() => null);
        if (!r || r.etape === "done" || r.etape === "failed") break;
      }
      setRevoq(null);
      navigate(`/admin/posts/${newPostId}`);
    } catch (e) {
      setRevoq(null);
      window.alert((e as Error).message);
    }
  }

  const post = useQuery({
    queryKey: ["post", id],
    queryFn: () => lirePost(id!),
    enabled: Boolean(id),
    // Pendant qu'un post de test se fabrique, on rafraîchit tout seul : la page
    // se met à jour quand c'est prêt, même si le build a été lancé ailleurs.
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && d.est_test && d.pipeline_statut !== "done" ? 4000 : false;
    },
  });
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

  // --- PILOTE DE BUILD (posts de TEST) : nettoyage du sujet puis composition
  // (Sophia), depuis la page, avec progression visible et REPRISE. Avant, tout se
  // jouait dans un seul long appel : dès que l'onglet dormait, le test mourait.
  const [build, setBuild] = React.useState<null | "nettoyage" | "sophia" | "echec">(null);
  const buildRef = React.useRef<string | null>(null);
  const enBuild = Boolean(post.data && post.data.est_test && post.data.pipeline_statut !== "done");

  // Aperçu du sujet (images d'origine + statut nettoyage), poll pendant le build.
  const apercu = useQuery({
    queryKey: ["apercu-sujet", post.data?.sujet_id],
    queryFn: () => apercuSujet(post.data!.sujet_id!),
    enabled: enBuild && Boolean(post.data?.sujet_id),
    refetchInterval: enBuild ? 3000 : false,
  });

  React.useEffect(() => {
    const p = post.data;
    if (!p || !p.est_test || p.pipeline_statut === "done") return;
    if (buildRef.current === p.id) return; // déjà en cours pour ce post
    buildRef.current = p.id;
    (async () => {
      try {
        // 1 — Nettoyage du sujet (jusqu'à done ; le cleanImage retombe sur une
        //     photo de la bibliothèque si Fal+Replicate échouent, donc ça aboutit).
        if (p.sujet_id) {
          for (let i = 0; i < 80; i += 1) {
            const { data: s } = await supabase
              .from("sujets")
              .select("preparation_statut")
              .eq("id", p.sujet_id)
              .single();
            if (s?.preparation_statut === "done") break;
            if (s?.preparation_statut === "failed") return setBuild("echec");
            setBuild("nettoyage");
            await lancerPreparation(p.sujet_id).catch(() => {});
            queryClient.invalidateQueries({ queryKey: ["apercu-sujet", p.sujet_id] });
          }
        }
        // 2 — Composition : traduction du deck puis intégration de Sophia.
        for (let i = 0; i < 15; i += 1) {
          const { data: pp } = await supabase
            .from("posts")
            .select("pipeline_statut")
            .eq("id", p.id)
            .single();
          if (pp?.pipeline_statut === "done") break;
          if (pp?.pipeline_statut === "failed") return setBuild("echec");
          setBuild("sophia");
          await avancerUnPost(p.id).catch(() => {});
        }
        setBuild(null);
        queryClient.invalidateQueries({ queryKey: ["post", p.id] });
        queryClient.invalidateQueries({ queryKey: ["slides", p.id] });
      } finally {
        buildRef.current = null;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.data?.id, post.data?.est_test, post.data?.pipeline_statut]);

  const liste = slides.data ?? [];
  const aProbleme = liste.filter((s) => !estPropre(s)).length;

  /**
   * Nettoie toutes les slides à texte via un pool d'agents parallèles (cf.
   * executerEnLot). Chaque nettoyage dure ~1 min ; les lancer en série serait
   * interminable, d'où le parallélisme.
   */
  async function nettoyerTout() {
    const aFaire = liste.filter((s) => !estPropre(s));
    setLot({ fait: 0, total: aFaire.length });
    setEtapesLot(
      Object.fromEntries(aFaire.map((s) => [s.id, etapesInitiales(premier)])),
    );
    await executerEnLot(
      aFaire,
      (slide) =>
        renettoyerSlide(slide.id, (ev) => {
          setEtapesLot((prev) => ({
            ...prev,
            [slide.id]: appliquerEvenement(
              prev[slide.id] ?? etapesInitiales(premier),
              ev,
              premier,
            ),
          }));
        }),
      {
        onProgres: (fait, total) => setLot({ fait, total }),
      },
    );
    setLot(null);
    setEtapesLot({});
    queryClient.invalidateQueries({ queryKey: ["slides", id] });
  }

  if (post.isPending || slides.isPending) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!post.data) return <p className="text-sm text-destructive">{t("common.notFoundTitle")}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/calendrier">{t("common.back")}</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {post.data.pipeline_statut === "done" && (
            <Button variant="outline" size="sm" asChild>
              {/* Vue « poster » : QR pour le mobile + ZIP + téléchargement photos. */}
              <Link to={`/posts/${id}`}>
                <QrCode className="size-4" />
                {t("adminPost.qrTelechargement")}
              </Link>
            </Button>
          )}
          {post.data.type !== "contenu" && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={revoq !== null}
              onClick={revoquerEtRefaire}
            >
              <RefreshCcw className="size-4" />
              {revoq ?? t("adminPost.revoquer")}
            </Button>
          )}
          <Badge variant="secondary">{t(`type.${post.data.type}`)}</Badge>
          <Badge variant={post.data.publie_at ? "success" : "outline"}>
            {t(`statut.${post.data.statut}`)}
          </Badge>
        </div>
      </div>

      {/* Mode : v-next = Slideshow bibliothèque ; legacy recycle/remanie/nouveau. */}
      <div
        className={
          post.data.type === "remanie"
            ? "rounded-lg border border-amber-500/40 bg-amber-500/10 p-3"
            : "rounded-lg border border-primary/40 bg-primary/10 p-3"
        }
      >
        <p className="text-base font-bold">
          {t(`type.${post.data.type}`)}
        </p>
        <p className="text-xs text-muted-foreground">{t(`adminPost.mode_${post.data.type}`)}</p>
      </div>

      {post.data.type !== "contenu" && (
        <p className="text-xs text-muted-foreground">{t("adminPost.revoquerAide")}</p>
      )}

      {/* Fabrication en direct (posts de test) : nettoyage photo par photo, puis
          placement micabo, puis le QR apparaît. Reprend tout seul si l'onglet a dormi. */}
      {enBuild && (
        <Card className="border-primary/40">
          <CardHeader className="pb-3">
            {build === "echec" ? (
              <CardTitle className="text-base text-destructive">{t("adminPost.buildEchec")}</CardTitle>
            ) : (
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="size-2 animate-pulse rounded-full bg-primary" />
                {build === "sophia" ? t("adminPost.buildmicabo") : t("adminPost.buildNettoyage")}
              </CardTitle>
            )}
            <CardDescription>{t("adminPost.buildAide")}</CardDescription>
            {build !== "echec" &&
              (() => {
                // Progression RÉELLE : part des slides déjà nettoyées (0-72 %),
                // puis l'étape placement (90 %). Pas d'estimation au doigt mouillé.
                const total = apercu.data?.length ?? 0;
                const propres = apercu.data?.filter((s) => s.url_propre).length ?? 0;
                const valeur =
                  build === "sophia" ? 90 : total ? 8 + Math.round((propres / total) * 72) : 8;
                return (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {build === "sophia"
                          ? t("adminPost.buildmicabo")
                          : t("adminPost.buildNettoyageCompte", { propres, total })}
                      </span>
                      <span className="tabular-nums">{valeur}%</span>
                    </div>
                    <Progress value={valeur} />
                  </div>
                );
              })()}
          </CardHeader>
          {apercu.data && apercu.data.length > 0 && (
            <CardContent>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {apercu.data.map((s) => (
                  <div key={s.position} className="space-y-1">
                    <img
                      src={s.url_propre ?? s.url_brute ?? ""}
                      alt=""
                      className={cn(
                        "aspect-[3/4] w-full rounded-md border object-cover",
                        !s.url_propre && "opacity-70",
                      )}
                    />
                    <p className="text-center text-[10px] font-medium">
                      {s.url_propre ? (
                        <span className="text-success">✓ {t("adminPost.buildNettoyee")}</span>
                      ) : (
                        <span className="text-muted-foreground">{t("adminPost.buildEnCours")}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{t("adminPost.title")}</CardTitle>
              <CardDescription>
                {aProbleme > 0
                  ? t("adminPost.aVerifier", { count: aProbleme })
                  : t("adminPost.toutPropre")}
              </CardDescription>
            </div>
            {aProbleme > 0 && (
              <Button size="sm" disabled={lot !== null} onClick={nettoyerTout}>
                <Sparkles />
                {lot
                  ? t("adminPost.lotEnCours", { fait: lot.fait, total: lot.total })
                  : t("adminPost.nettoyerTout", { count: aProbleme })}
              </Button>
            )}
          </div>
          {lot && (
            <p className="pt-1 text-xs text-muted-foreground">{t("adminPost.lotAide")}</p>
          )}
        </CardHeader>
      </Card>

      {liste.map((slide) => (
        <SlideAdmin
          key={slide.id}
          slide={slide}
          postId={id!}
          compteReferenceId={refId.data ?? null}
          premier={premier}
          etapesLot={etapesLot[slide.id] ?? null}
        />
      ))}
    </div>
  );
}
