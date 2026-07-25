import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, Eye, Recycle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import { listerReproduisibles, type PostReproduisible } from "@/features/moteur/api";

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

/**
 * Page « Posts reproduisibles » : le STOCK de sujets prêts à reproduire, par
 * source de référence. Un post reproduisible = pertinent (culture générale,
 * self-improvement, anti-doomscroll) ET assez performant. Chaque compte de
 * référence doit toujours en avoir en réserve pour l'assignation de minuit.
 */
export function AdminReproduciblesPage() {
  const { t } = useTranslation();
  const posts = useQuery({ queryKey: ["reproduisibles"], queryFn: listerReproduisibles });
  const [source, setSource] = React.useState("");

  const sources = React.useMemo(
    () =>
      [...new Set((posts.data ?? []).map((p) => p.reference_handle).filter(Boolean))].sort() as string[],
    [posts.data],
  );

  const parSource = React.useMemo(() => {
    const m = new Map<string, PostReproduisible[]>();
    for (const p of posts.data ?? []) {
      if (source && p.reference_handle !== source) continue;
      const k = p.reference_handle ?? "—";
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return m;
  }, [posts.data, source]);

  const total = [...parSource.values()].reduce((n, l) => n + l.length, 0);

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
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">{t("reproduisibles.toutesSources")}</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                @{s}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {posts.isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {posts.isError && (
        <p className="text-sm text-destructive">{(posts.error as Error).message}</p>
      )}
      {posts.data && total === 0 && <EmptyState title={t("reproduisibles.vide")} />}

      {[...parSource.entries()].map(([src, liste]) => (
        <section key={src} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">@{src}</h2>
            <Badge variant="outline">{t("reproduisibles.enStock", { count: liste.length })}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {liste.map((p) => (
              <CartePost key={p.id} post={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
