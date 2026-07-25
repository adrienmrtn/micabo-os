import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download, ExternalLink, Eye, Link2, Recycle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import {
  ajouterLienAuStock,
  lancerExtraction,
  listerReproduisibles,
  listerSources,
  type PostReproduisible,
} from "@/features/moteur/api";
import type { CompteReference } from "@/features/moteur/types";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:max-w-xs";

/** Vues compactes : 12 300 → « 12,3k », 1 200 000 → « 1,2M ». */
function formatVues(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "").replace(".", ",")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "").replace(".", ",")}k`;
  return String(n);
}

/** Un post reproduisible : aperçu des photos, hook en titre, vues, lien TikTok. */
function CartePost({ post }: { post: PostReproduisible }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Aperçu des photos : rangée horizontale scrollable. */}
        {post.apercus.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-md border border-dashed bg-muted/30 text-xs text-muted-foreground">
            {t("reproduisibles.sansPhoto")}
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {post.apercus.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                loading="lazy"
                className="h-32 w-auto shrink-0 rounded-md border object-cover"
              />
            ))}
          </div>
        )}

        {/* Titre = le hook (texte de la 1ʳᵉ photo). */}
        <p className="text-sm font-medium leading-snug">
          {post.hook || <span className="text-muted-foreground">{t("reproduisibles.sansHook")}</span>}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {post.en_preparation && (
            <Badge variant="warning">{t("reproduisibles.enPreparation")}</Badge>
          )}
          <Badge variant="secondary">
            <Eye className="mr-1 size-3" />
            {formatVues(post.vues)} {t("reproduisibles.vues")}
          </Badge>
          {post.pertinence_score != null && (
            <Badge variant="outline">
              {t("reproduisibles.pertinence")} {post.pertinence_score}
            </Badge>
          )}
          {post.source_url && (
            <a
              href={post.source_url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2"
            >
              <ExternalLink className="size-3.5" />
              {t("reproduisibles.voirTikTok")}
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Une source + son stock, avec les deux actions : aller chercher + de posts
 *  (scrape API du profil) et rentrer un lien directement dans le stock. */
function SectionSource({ source, posts }: { source: CompteReference; posts: PostReproduisible[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [ouvert, setOuvert] = React.useState(false);
  const [lien, setLien] = React.useState("");
  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["reproduisibles"] });

  const scraper = useMutation({
    mutationFn: () => lancerExtraction(source.id),
    onSuccess: rafraichir,
  });
  const ajouter = useMutation({
    mutationFn: () => ajouterLienAuStock(lien.trim(), source.id),
    onSuccess: () => {
      setLien("");
      setOuvert(false);
      rafraichir();
    },
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">@{source.handle_tiktok}</h2>
        <Badge variant="outline">{t("reproduisibles.enStock", { count: posts.length })}</Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={scraper.isPending} onClick={() => scraper.mutate()}>
            <Download className={`size-4 ${scraper.isPending ? "animate-pulse" : ""}`} />
            {scraper.isPending ? t("reproduisibles.recherche") : t("reproduisibles.chercherPlus")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOuvert((v) => !v)}>
            <Link2 className="size-4" />
            {t("reproduisibles.ajouterLien")}
          </Button>
        </div>
      </div>

      {scraper.isSuccess && (
        <p className="text-xs text-success">{t("reproduisibles.scrapeLance")}</p>
      )}
      {scraper.isError && (
        <p className="text-xs text-destructive">{(scraper.error as Error).message}</p>
      )}

      {ouvert && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (lien.trim()) ajouter.mutate();
          }}
          className="space-y-1.5 rounded-md border border-dashed p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="https://www.tiktok.com/@compte/photo/…"
              value={lien}
              onChange={(e) => setLien(e.target.value)}
              className="min-w-64 flex-1"
            />
            <Button type="submit" size="sm" disabled={ajouter.isPending || !lien.trim()}>
              {ajouter.isPending ? t("reproduisibles.ajoutEnCours") : t("reproduisibles.ajouter")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("reproduisibles.ajouterAide")}</p>
          {ajouter.isSuccess && (
            <p className="text-xs text-success">
              {ajouter.data.reused ? t("reproduisibles.dejaConnu") : t("reproduisibles.ajoutOk")}
            </p>
          )}
          {ajouter.isError && (
            <p className="text-xs text-destructive">{(ajouter.error as Error).message}</p>
          )}
        </form>
      )}

      {posts.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("reproduisibles.sourceVide")}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {posts.map((p) => (
            <CartePost key={p.id} post={p} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Page « Posts reproduisibles » : le STOCK de sujets prêts à reproduire, par
 * source de référence. Un post reproduisible = pertinent (culture générale,
 * self-improvement, anti-doomscroll) ET assez performant. Chaque source affiche
 * deux actions : aller chercher plus de posts (scrape API) ou rentrer un lien.
 */
export function AdminReproduciblesPage() {
  const { t } = useTranslation();
  const posts = useQuery({ queryKey: ["reproduisibles"], queryFn: listerReproduisibles });
  const sources = useQuery({ queryKey: ["sources"], queryFn: listerSources });
  const [filtre, setFiltre] = React.useState("");

  const parSource = React.useMemo(() => {
    const m = new Map<string, PostReproduisible[]>();
    for (const p of posts.data ?? []) {
      if (!p.reference_id) continue;
      const arr = m.get(p.reference_id) ?? [];
      arr.push(p);
      m.set(p.reference_id, arr);
    }
    return m;
  }, [posts.data]);

  // On liste TOUTES les sources (même à 0 en stock) pour toujours proposer les
  // boutons ; filtrées par le sélecteur.
  const sourcesAffichees = (sources.data ?? []).filter((s) => !filtre || s.id === filtre);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Recycle className="size-4 text-primary" />
            {t("reproduisibles.title")}
          </CardTitle>
          <CardDescription>{t("reproduisibles.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            aria-label={t("reproduisibles.filtreSource")}
            className={selectClass}
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
          >
            <option value="">{t("reproduisibles.toutesSources")}</option>
            {(sources.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                @{s.handle_tiktok}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {(posts.isPending || sources.isPending) && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}
      {posts.isError && (
        <p className="text-sm text-destructive">{(posts.error as Error).message}</p>
      )}
      {sources.data && sourcesAffichees.length === 0 && <EmptyState title={t("reproduisibles.vide")} />}

      {sourcesAffichees.map((s) => (
        <SectionSource key={s.id} source={s} posts={parSource.get(s.id) ?? []} />
      ))}
    </div>
  );
}
