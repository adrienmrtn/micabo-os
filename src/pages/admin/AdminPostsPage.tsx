import * as React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

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
import { listerComptes, listerPosts, reassignerPost } from "@/features/moteur/api";
import type { Post } from "@/features/moteur/types";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function badgePipeline(statut: string) {
  if (statut === "done") return "success";
  if (statut === "failed") return "destructive";
  if (statut === "running") return "warning";
  return "secondary";
}

/** Réassignation d'un post existant vers un autre compte ou une autre date. */
function LignePost({
  post,
  comptes,
}: {
  post: Post;
  comptes: Array<{ id: string; persona_nom: string | null; handle_tiktok: string | null }>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [compteId, setCompteId] = React.useState(post.compte_id);
  const [date, setDate] = React.useState(post.date_publication_prevue ?? "");

  const modifie =
    compteId !== post.compte_id || date !== (post.date_publication_prevue ?? "");

  const enregistrer = useMutation({
    mutationFn: () =>
      reassignerPost(post.id, {
        compte_id: compteId,
        date_publication_prevue: date || null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  const compte = comptes.find((c) => c.id === post.compte_id);

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {compte?.persona_nom ?? compte?.handle_tiktok ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {post.date_publication_prevue ?? t("posts.sansDate")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{t(`type.${post.type}`)}</Badge>
          <Badge variant="outline">{t(`statut.${post.statut}`)}</Badge>
          <Badge variant={badgePipeline(post.pipeline_statut)}>
            {t(`statut.${post.pipeline_statut}`)}
          </Badge>
        </div>
      </div>

      {post.pipeline_erreur && (
        <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          {post.pipeline_erreur}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <select
          aria-label={t("posts.reassignerA")}
          className={selectClass}
          value={compteId}
          onChange={(e) => setCompteId(e.target.value)}
        >
          {comptes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.persona_nom ?? c.handle_tiktok ?? c.id.slice(0, 8)}
            </option>
          ))}
        </select>

        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <div className="flex gap-2">
          {modifie && (
            <Button size="sm" disabled={enregistrer.isPending} onClick={() => enregistrer.mutate()}>
              {enregistrer.isPending ? t("common.saving") : t("posts.reassigner")}
            </Button>
          )}
          {post.pipeline_statut === "done" && (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/posts/${post.id}`}>{t("posts.apercu")}</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminPostsPage() {
  const { t } = useTranslation();

  const posts = useQuery({ queryKey: ["posts"], queryFn: () => listerPosts() });
  const comptes = useQuery({ queryKey: ["comptes"], queryFn: listerComptes });

  const listeComptes = (comptes.data ?? []).map((c) => ({
    id: c.id,
    persona_nom: c.persona_nom,
    handle_tiktok: c.handle_tiktok,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("posts.tous")}</CardTitle>
          <CardDescription>{t("posts.tousDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {posts.isPending && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {posts.data?.length === 0 && <EmptyState title={t("posts.empty")} />}
          {posts.data?.map((post) => (
            <LignePost key={post.id} post={post} comptes={listeComptes} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
