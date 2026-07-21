import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import { statsComptes, statsPosts } from "@/features/moteur/api";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-72";

/** Les grands nombres se lisent mal en entier sur une ligne de tableau. */
function abrege(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function Total({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums">{valeur}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function AdminAnalyticsPage() {
  const { t, i18n } = useTranslation();
  const [compteId, setCompteId] = React.useState("");

  const comptes = useQuery({ queryKey: ["stats-comptes"], queryFn: statsComptes });
  const posts = useQuery({
    queryKey: ["stats-posts", compteId || "tous"],
    queryFn: () => statsPosts(compteId || undefined),
  });

  const cumul = (comptes.data ?? []).reduce(
    (acc, c) => ({
      vues: acc.vues + Number(c.vues_totales),
      likes: acc.likes + Number(c.likes_totaux),
      publies: acc.publies + Number(c.posts_publies),
      attente: acc.attente + Number(c.posts_en_attente),
    }),
    { vues: 0, likes: 0, publies: 0, attente: 0 },
  );

  const mesures = (posts.data ?? []).filter((p) => p.vues !== null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Total label={t("analytics.vues")} valeur={abrege(cumul.vues)} />
        <Total label={t("analytics.likes")} valeur={abrege(cumul.likes)} />
        <Total label={t("analytics.publies")} valeur={String(cumul.publies)} />
        <Total label={t("analytics.enAttente")} valeur={String(cumul.attente)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("analytics.parCompte")}</CardTitle>
          <CardDescription>{t("analytics.parCompteDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {comptes.isPending && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {comptes.data?.length === 0 && <EmptyState title={t("analytics.aucunCompte")} />}

          {comptes.data?.map((c) => (
            <div
              key={c.compte_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {c.persona_nom ?? c.handle_tiktok ?? "—"}
                  </span>
                  {!c.is_active && <Badge variant="secondary">{t("sources.inactive")}</Badge>}
                  <Badge variant="outline">{c.langue.toUpperCase()}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[c.poster_prenom, c.poster_nom].filter(Boolean).join(" ") || "—"}
                </p>
              </div>

              <div className="flex gap-4 text-sm tabular-nums">
                <span title={t("analytics.vues")}>👁 {abrege(Number(c.vues_totales))}</span>
                <span title={t("analytics.likes")}>♥ {abrege(Number(c.likes_totaux))}</span>
                <span className="text-muted-foreground">
                  {c.posts_publies}/{c.posts_total}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-4" />
                {t("analytics.meilleursPosts")}
              </CardTitle>
              <CardDescription>{t("analytics.meilleursPostsDesc")}</CardDescription>
            </div>
            <select
              aria-label={t("analytics.parCompte")}
              className={selectClass}
              value={compteId}
              onChange={(e) => setCompteId(e.target.value)}
            >
              <option value="">{t("analytics.tousComptes")}</option>
              {comptes.data?.map((c) => (
                <option key={c.compte_id} value={c.compte_id}>
                  {c.persona_nom ?? c.handle_tiktok ?? c.compte_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {posts.isPending && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}

          {mesures.length === 0 && !posts.isPending && (
            <EmptyState
              title={t("analytics.aucuneMesure")}
              description={t("analytics.aucuneMesureAide")}
            />
          )}

          {mesures.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {p.sujet_titre ?? t("posts.title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[
                    p.persona_nom ?? p.handle_tiktok,
                    t(`type.${p.type}`),
                    p.publie_at
                      ? new Date(p.publie_at).toLocaleDateString(i18n.language)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div className="flex gap-4 text-sm tabular-nums">
                <span>👁 {abrege(p.vues)}</span>
                <span>♥ {abrege(p.likes)}</span>
                <span>💬 {abrege(p.commentaires)}</span>
              </div>

              {p.publie_url && (
                <a
                  href={p.publie_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline underline-offset-4"
                >
                  {t("analytics.voirTikTok")}
                </a>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
