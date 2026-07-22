import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/card";
import { postsCalendrierAdmin, type PostCalendrierAdmin } from "@/features/moteur/api";
import { cn } from "@/lib/utils";

function isoDuJour(annee: number, mois: number, jour: number): string {
  return `${annee}-${String(mois + 1).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/** Grille du mois, lundi en tête (getDay compte à partir de dimanche). */
function grilleDuMois(annee: number, mois: number) {
  const decalage = (new Date(annee, mois, 1).getDay() + 6) % 7;
  const joursDansLeMois = new Date(annee, mois + 1, 0).getDate();
  const cases: Array<number | null> = Array.from({ length: decalage }, () => null);
  for (let jour = 1; jour <= joursDansLeMois; jour += 1) cases.push(jour);
  while (cases.length % 7 !== 0) cases.push(null);
  return cases;
}

function etiquette(post: PostCalendrierAdmin): string {
  return post.persona_nom ?? (post.handle_tiktok ? `@${post.handle_tiktok}` : "—");
}

export function AdminCalendrierPage() {
  const { t, i18n } = useTranslation();
  const { data: posts, isPending } = useQuery({
    queryKey: ["posts-calendrier-admin"],
    queryFn: postsCalendrierAdmin,
  });

  const maintenant = new Date();
  const [mois, setMois] = React.useState(() => ({
    annee: maintenant.getFullYear(),
    mois: maintenant.getMonth(),
  }));

  const parJour = React.useMemo(() => {
    const carte = new Map<string, PostCalendrierAdmin[]>();
    for (const post of posts ?? []) {
      const date = post.date_publication_prevue;
      if (!date) continue;
      carte.set(date, [...(carte.get(date) ?? []), post]);
    }
    return carte;
  }, [posts]);

  if (isPending) {
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold capitalize tracking-tight">{nomDuMois}</h2>
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

      {posts?.length === 0 && <EmptyState title={t("posts.empty")} />}

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
                      estAujourdhui
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {numero}
                  </span>

                  {duJour.map((post) => (
                    <Link
                      key={post.id}
                      to={`/admin/posts/${post.id}`}
                      title={`${etiquette(post)} — ${post.sujet_titre ?? ""}`}
                      className={cn(
                        "block w-full max-w-full truncate rounded px-1.5 py-1 text-[11px] leading-tight transition-colors",
                        post.publie_at
                          ? "bg-success/15 text-success hover:bg-success/25"
                          : post.pipeline_statut !== "done"
                            ? "bg-warning/15 text-warning hover:bg-warning/25"
                            : "bg-primary/15 text-primary hover:bg-primary/25",
                      )}
                    >
                      {post.publie_at ? "✓ " : ""}
                      {etiquette(post)}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t("adminCal.legende")}</p>
    </div>
  );
}
