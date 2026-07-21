import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarCheck, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { aujourdhui } from "@/features/moteur/api";
import { useAuth } from "@/features/auth/AuthContext";

interface PostCalendrier {
  id: string;
  date_publication_prevue: string | null;
  type: string;
  statut: string;
  persona_nom: string | null;
  handle_tiktok: string | null;
  sujet_titre: string | null;
  publie_at: string | null;
}

/** Lit la vue `posts_poster`, qui ne révèle jamais le compte de référence. */
async function mesPosts(): Promise<PostCalendrier[]> {
  const { data, error } = await supabase
    .from("posts_poster")
    .select("*")
    .order("date_publication_prevue", { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) throw error;
  return data as PostCalendrier[];
}

function CartePost({ post, creneau }: { post: PostCalendrier; creneau?: number }) {
  const { t } = useTranslation();
  const publie = Boolean(post.publie_at);

  return (
    <Card className={publie ? "opacity-70" : "border-primary/30 shadow-lifted"}>
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-snug">
              {post.sujet_titre ?? t("posts.title")}
            </p>
            {publie && <CheckCircle2 className="size-5 shrink-0 text-success" />}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {creneau && <Badge variant="outline">{t("calendrier.creneau", { n: creneau })}</Badge>}
            <Badge variant="secondary">{t(`type.${post.type}`)}</Badge>
            {post.handle_tiktok && <Badge variant="outline">@{post.handle_tiktok}</Badge>}
          </div>
        </div>

        <Button asChild size="lg" className="w-full" variant={publie ? "outline" : "default"}>
          <Link to={`/posts/${post.id}`}>
            {publie ? t("posts.apercu") : t("posts.valider")}
            <ArrowRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function PosterCalendrierPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data: posts, isPending } = useQuery({
    queryKey: ["mes-posts", user?.id],
    queryFn: mesPosts,
    enabled: Boolean(user?.id),
  });

  if (isPending) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  const jour = aujourdhui();
  const duJour = (posts ?? []).filter((p) => p.date_publication_prevue === jour);
  const aVenir = (posts ?? []).filter(
    (p) => p.date_publication_prevue && p.date_publication_prevue > jour,
  );
  const passe = (posts ?? []).filter(
    (p) => p.date_publication_prevue && p.date_publication_prevue < jour,
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">{t("calendrier.aujourdhui")}</h2>
        {duJour.length === 0 ? (
          <EmptyState icon={<CalendarCheck className="size-5" />} title={t("calendrier.rien")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {duJour.map((post, index) => (
              <CartePost key={post.id} post={post} creneau={index + 1} />
            ))}
          </div>
        )}
      </section>

      {aVenir.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{t("calendrier.aVenir")}</h2>
          <div className="space-y-2">
            {aVenir.map((post) => (
              <Link
                key={post.id}
                to={`/posts/${post.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
              >
                <span className="min-w-0 truncate text-sm">
                  {post.sujet_titre ?? t("posts.title")}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(post.date_publication_prevue!).toLocaleDateString(i18n.language)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {passe.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{t("calendrier.passe")}</h2>
          <div className="space-y-2">
            {passe.map((post) => (
              <Link
                key={post.id}
                to={`/posts/${post.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-muted-foreground transition-colors hover:bg-muted"
              >
                <span className="min-w-0 truncate text-sm">
                  {post.sujet_titre ?? t("posts.title")}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  {post.publie_at && <CheckCircle2 className="size-4 text-success" />}
                  {new Date(post.date_publication_prevue!).toLocaleDateString(i18n.language)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
