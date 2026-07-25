import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/card";
import { postsCalendrierAdmin, type PostCalendrierAdmin } from "@/features/moteur/api";
import { cn } from "@/lib/utils";

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
function nomCreateur(post: PostCalendrierAdmin): string {
  const perso = [post.poster_prenom, post.poster_nom].filter(Boolean).join(" ");
  return perso || post.persona_nom || (post.handle_tiktok ? `@${post.handle_tiktok}` : "—");
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

  const legende = React.useMemo(() => {
    const vus = new Map<string, PostCalendrierAdmin>();
    for (const post of posts ?? []) if (!vus.has(post.compte_id)) vus.set(post.compte_id, post);
    return [...vus.values()];
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
          {legende.map((post) => (
            <span key={post.compte_id} className="flex items-center gap-1.5 text-xs">
              <span className="size-3 rounded-full border" style={couleurs(post.compte_id)} />
              {nomCreateur(post)}
            </span>
          ))}
        </div>
      )}

      {posts?.length === 0 && <EmptyState title={t("hiring.calendrierVide")} />}

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

                  {duJour.map((post) => (
                    <div
                      key={post.id}
                      title={`${nomCreateur(post)} — ${post.sujet_titre ?? ""}`}
                      style={couleurs(post.compte_id)}
                      className={cn(
                        "flex w-full max-w-full items-center gap-1 rounded border px-1.5 py-1 text-[11px] leading-tight",
                        post.pipeline_statut !== "done" && "opacity-60",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {post.publie_at ? "✓ " : ""}
                        {nomCreateur(post)}
                      </span>
                    </div>
                  ))}
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
