import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/card";
import {
  lirePost,
  listerSlides,
  papierPostsCalendrier,
  postsCalendrierAdmin,
  type PapierPostCalendrier,
  type PostCalendrierAdmin,
} from "@/features/moteur/api";
import { cn } from "@/lib/utils";

/** Aperçu (lecture seule) d'un post : ses slides — image nettoyée + texte. */
function ApercuPost({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const post = useQuery({ queryKey: ["post", postId], queryFn: () => lirePost(postId) });
  const slides = useQuery({ queryKey: ["slides", postId], queryFn: () => listerSlides(postId) });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{t("hiring.apercuTitre")}</p>
            {post.data && <Badge variant="secondary">{t(`type.${post.data.type}`)}</Badge>}
            {post.data && (
              <Badge variant={post.data.publie_at ? "success" : "outline"}>
                {t(`statut.${post.data.statut}`)}
              </Badge>
            )}
          </div>
          <Button size="icon" variant="ghost" aria-label={t("common.close")} onClick={onClose}>
            <X />
          </Button>
        </div>

        {slides.isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
        {slides.data && slides.data.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("hiring.apercuVide")}</p>
        )}

        <div className="space-y-3">
          {slides.data?.map((s) => (
            <div key={s.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr]">
              {s.media_library?.url ? (
                <img
                  src={s.media_library.url}
                  alt=""
                  className="h-40 w-auto rounded-md border object-cover"
                />
              ) : (
                <div className="flex h-40 w-28 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                  —
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("posts.slide", { position: s.position })}
                </p>
                <p className="whitespace-pre-wrap text-sm">{s.texte_overlay}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function isoDuJour(annee: number, mois: number, jour: number): string {
  return `${annee}-${String(mois + 1).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

function grilleDuMois(annee: number, mois: number) {
  const decalage = (new Date(annee, mois, 1).getDay() + 6) % 7;
  const joursDansLeMois = new Date(annee, mois + 1, 0).getDate();
  const cases: Array<number | null> = Array.from({ length: decalage }, () => null);
  for (let jour = 1; jour <= joursDansLeMois; jour += 1) cases.push(jour);
  while (cases.length % 7 !== 0) cases.push(null);
  return cases;
}

/** Teinte stable par compte : le même créateur garde sa couleur d'un jour à l'autre. */
function teinte(compteId: string): number {
  let hash = 0;
  for (const c of compteId) hash = (hash * 31 + c.charCodeAt(0)) % 360;
  return hash;
}
function couleurs(compteId: string): React.CSSProperties {
  const h = teinte(compteId);
  return {
    backgroundColor: `hsl(${h} 70% 93%)`,
    color: `hsl(${h} 55% 30%)`,
    borderColor: `hsl(${h} 60% 80%)`,
  };
}
function nomCreateur(post: { poster_prenom?: string | null; poster_nom?: string | null; persona_nom?: string | null; handle_tiktok?: string | null }): string {
  const perso = [post.poster_prenom, post.poster_nom].filter(Boolean).join(" ");
  return perso || post.persona_nom || (post.handle_tiktok ? `@${post.handle_tiktok}` : "—");
}

function ApercuPapier({
  post,
  onClose,
}: {
  post: PapierPostCalendrier;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("hiring.apercuPapier")}</p>
            <p className="text-xs text-muted-foreground">
              {nomCreateur(post)} · {post.date_publication_prevue}
            </p>
          </div>
          <Button size="icon" variant="ghost" aria-label={t("common.close")} onClick={onClose}>
            <X />
          </Button>
        </div>
        <video src={post.video_url} className="mb-3 w-full rounded-md bg-muted" controls playsInline />
        {post.title ? <p className="mb-2 text-sm font-medium">{post.title}</p> : null}
        {post.caption ? (
          <p className="mb-2 whitespace-pre-wrap text-sm text-muted-foreground">{post.caption}</p>
        ) : null}
        {post.hashtags ? <p className="mb-3 text-xs text-muted-foreground">{post.hashtags}</p> : null}
        <Button asChild variant="outline" className="w-full">
          <a href={post.video_url} download target="_blank" rel="noreferrer">
            <Download className="size-3.5" />
            {t("cm.telecharger")}
          </a>
        </Button>
      </div>
    </div>
  );
}

/**
 * Calendrier LECTURE SEULE pour le hiring manager : les posts de SES créateurs
 * par jour (la RLS `posts_select_hiring` limite déjà aux siens). Pas de
 * glisser-déposer ni de suppression — c'est une vue de suivi.
 */
export function HiringCalendrierPage() {
  const { t, i18n } = useTranslation();

  const { data: posts, isPending } = useQuery({
    queryKey: ["posts-calendrier-manager"],
    queryFn: postsCalendrierAdmin,
  });
  const { data: papiers, isPending: papierPending } = useQuery({
    queryKey: ["papier-posts-calendrier-manager"],
    queryFn: papierPostsCalendrier,
  });

  const maintenant = new Date();
  const [mois, setMois] = React.useState(() => ({
    annee: maintenant.getFullYear(),
    mois: maintenant.getMonth(),
  }));
  const [apercu, setApercu] = React.useState<string | null>(null);
  const [apercuPapier, setApercuPapier] = React.useState<PapierPostCalendrier | null>(null);

  type ItemJour =
    | { kind: "slide"; post: PostCalendrierAdmin }
    | { kind: "papier"; post: PapierPostCalendrier };

  const parJour = React.useMemo(() => {
    const carte = new Map<string, ItemJour[]>();
    for (const post of posts ?? []) {
      const date = post.date_publication_prevue;
      if (!date) continue;
      carte.set(date, [...(carte.get(date) ?? []), { kind: "slide", post }]);
    }
    for (const post of papiers ?? []) {
      const date = post.date_publication_prevue;
      if (!date) continue;
      carte.set(date, [...(carte.get(date) ?? []), { kind: "papier", post }]);
    }
    return carte;
  }, [posts, papiers]);

  const legende = React.useMemo(() => {
    const vus = new Map<string, { compte_id: string; nom: string }>();
    for (const post of posts ?? []) {
      if (!vus.has(post.compte_id)) {
        vus.set(post.compte_id, { compte_id: post.compte_id, nom: nomCreateur(post) });
      }
    }
    for (const post of papiers ?? []) {
      if (!vus.has(post.compte_id)) {
        vus.set(post.compte_id, { compte_id: post.compte_id, nom: `${nomCreateur(post)} · CM` });
      }
    }
    return [...vus.values()];
  }, [posts, papiers]);

  if (isPending || papierPending) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  const cases = grilleDuMois(mois.annee, mois.mois);
  const nomDuMois = new Date(mois.annee, mois.mois, 1).toLocaleDateString(i18n.language, {
    month: "long",
    year: "numeric",
  });
  const enTetes = Array.from({ length: 7 }, (_, index) =>
    new Date(2024, 0, index + 1).toLocaleDateString(i18n.language, { weekday: "short" }),
  );
  const decaler = (pas: number) =>
    setMois((actuel) => {
      const date = new Date(actuel.annee, actuel.mois + pas, 1);
      return { annee: date.getFullYear(), mois: date.getMonth() };
    });
  const jour = isoDuJour(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());

  return (
    <div className="space-y-4">
      {apercu && <ApercuPost postId={apercu} onClose={() => setApercu(null)} />}
      {apercuPapier && <ApercuPapier post={apercuPapier} onClose={() => setApercuPapier(null)} />}

      <div>
        <h1 className="text-lg font-semibold tracking-tight">{t("hiring.calendrierTitre")}</h1>
        <p className="text-sm text-muted-foreground">{t("hiring.calendrierSous")}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold capitalize tracking-tight">{nomDuMois}</h2>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label={t("calendrier.moisPrecedent")} onClick={() => decaler(-1)}>
            <ChevronLeft />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMois({ annee: maintenant.getFullYear(), mois: maintenant.getMonth() })}
          >
            {t("calendrier.revenirAujourdhui")}
          </Button>
          <Button size="icon" variant="ghost" aria-label={t("calendrier.moisSuivant")} onClick={() => decaler(1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      {legende.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {legende.map((item) => (
            <span key={item.compte_id} className="flex items-center gap-1.5 text-xs">
              <span className="size-3 rounded-full border" style={couleurs(item.compte_id)} />
              {item.nom}
            </span>
          ))}
        </div>
      )}

      {posts?.length === 0 && (papiers?.length ?? 0) === 0 && (
        <EmptyState title={t("hiring.calendrierVide")} />
      )}

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {enTetes.map((nom) => (
              <div key={nom} className="p-2 text-center text-xs font-medium uppercase text-muted-foreground">
                {nom}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cases.map((numero, index) => {
              if (numero === null) {
                return <div key={`vide-${index}`} className="min-h-24 border-b border-r bg-muted/20" />;
              }
              const date = isoDuJour(mois.annee, mois.mois, numero);
              const duJour = parJour.get(date) ?? [];
              const estAujourdhui = date === jour;

              return (
                <div
                  key={date}
                  className={cn(
                    "min-h-24 min-w-0 space-y-1 border-b border-r p-1.5",
                    estAujourdhui && "bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs",
                      estAujourdhui ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {numero}
                  </span>

                  {duJour.map((item) =>
                    item.kind === "papier" ? (
                      <button
                        key={item.post.id}
                        type="button"
                        onClick={() => setApercuPapier(item.post)}
                        title={`${nomCreateur(item.post)} — ${item.post.title ?? ""}`}
                        style={couleurs(item.post.compte_id)}
                        className="flex w-full max-w-full cursor-pointer items-center gap-1 rounded border px-1.5 py-1 text-left text-[11px] leading-tight transition hover:brightness-95"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          CM · {nomCreateur(item.post)}
                        </span>
                      </button>
                    ) : (
                      <button
                        key={item.post.id}
                        type="button"
                        onClick={() => setApercu(item.post.id)}
                        title={`${nomCreateur(item.post)} — ${item.post.sujet_titre ?? ""}`}
                        style={couleurs(item.post.compte_id)}
                        className={cn(
                          "flex w-full max-w-full cursor-pointer items-center gap-1 rounded border px-1.5 py-1 text-left text-[11px] leading-tight transition hover:brightness-95",
                          item.post.pipeline_statut !== "done" && "opacity-60",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {item.post.publie_at ? "✓ " : ""}
                          {nomCreateur(item.post)}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t("hiring.calendrierLegende")}</p>
    </div>
  );
}
