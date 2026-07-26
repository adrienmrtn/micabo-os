import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ListOrdered } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import { listerComptes, listerSources, majSource } from "@/features/moteur/api";
import { nomLangue } from "@/features/moteur/langues";
import type { CompteReference } from "@/features/moteur/types";

/** Rang effectif d'une source pour une langue : ordre propre à la langue, sinon
 *  ordre global, sinon très loin. */
function rang(s: CompteReference, langue: string): number {
  return s.ordre_par_langue?.[langue] ?? s.ordre_assignation ?? 9999;
}

/** Une file par langue : on range les sources INDÉPENDAMMENT pour cette langue,
 *  et on voit laquelle part au prochain poster de la langue. */
function FileLangue({
  langue,
  sources,
  pris,
}: {
  langue: string;
  sources: CompteReference[];
  pris: Set<string>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const ordonnees = React.useMemo(
    () =>
      sources
        .slice()
        .sort((a, b) => rang(a, langue) - rang(b, langue) || a.handle_tiktok.localeCompare(b.handle_tiktok)),
    [sources, langue],
  );

  // Échange le rang (pour CETTE langue) de deux sources adjacentes. On écrit un
  // ordre_par_langue explicite pour les deux, en fusionnant l'objet existant.
  const echanger = useMutation({
    mutationFn: async (v: { a: CompteReference; b: CompteReference }) => {
      const ra = rang(v.a, langue);
      const rb = rang(v.b, langue);
      await majSource(v.a.id, { ordre_par_langue: { ...v.a.ordre_par_langue, [langue]: rb } });
      await majSource(v.b.id, { ordre_par_langue: { ...v.b.ordre_par_langue, [langue]: ra } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sources"] }),
  });

  const libres = ordonnees.filter((s) => !pris.has(s.id));
  const prochaine = libres[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{nomLangue(langue)}</CardTitle>
          <Badge variant="outline">{t("assignSources.libres", { count: libres.length })}</Badge>
          {prochaine ? (
            <span className="text-sm">
              {t("assignSources.prochaine")}{" "}
              <span className="font-semibold">@{prochaine.handle_tiktok}</span>
            </span>
          ) : (
            <span className="text-sm text-destructive">{t("assignSources.aucuneLibre")}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {ordonnees.map((s, i) => {
          const estPris = pris.has(s.id);
          return (
            <div
              key={s.id}
              className={`flex items-center justify-between gap-3 rounded-lg border p-2 ${estPris ? "opacity-50" : ""}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate text-sm font-medium">@{s.handle_tiktok}</span>
                {estPris && <Badge variant="secondary">{t("assignSources.pris")}</Badge>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-7"
                  disabled={i === 0 || echanger.isPending}
                  onClick={() => echanger.mutate({ a: s, b: ordonnees[i - 1] })}
                  aria-label={t("assignSources.monter")}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-7"
                  disabled={i === ordonnees.length - 1 || echanger.isPending}
                  onClick={() => echanger.mutate({ a: s, b: ordonnees[i + 1] })}
                  aria-label={t("assignSources.descendre")}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * Ordre d'assignation des sources, INDÉPENDANT PAR LANGUE : une file rangeable
 * par langue. À la création d'un poster d'une langue, il reçoit la source LIBRE
 * la plus haute dans la file de cette langue.
 */
export function AdminAssignationPage() {
  const { t } = useTranslation();
  const sources = useQuery({ queryKey: ["sources"], queryFn: listerSources });
  const comptes = useQuery({ queryKey: ["comptes"], queryFn: listerComptes });

  // Seuls les PRINCIPAUX actifs sont assignables.
  const principaux = React.useMemo(
    () => (sources.data ?? []).filter((s) => !s.parent_id && s.is_active),
    [sources.data],
  );

  // Sources déjà prises, par langue (une source = un poster par langue).
  const prisParLangue = React.useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const c of comptes.data ?? []) {
      if (!c.compte_reference_id) continue;
      const set = m.get(c.langue) ?? new Set<string>();
      set.add(c.compte_reference_id);
      m.set(c.langue, set);
    }
    return m;
  }, [comptes.data]);

  // Toutes les langues : celles des posters + celles des sources.
  const langues = React.useMemo(() => {
    const s = new Set<string>();
    for (const c of comptes.data ?? []) s.add(c.langue);
    for (const src of principaux) s.add(src.langue);
    return [...s].sort();
  }, [comptes.data, principaux]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="size-4 text-primary" />
            {t("assignSources.title")}
          </CardTitle>
          <CardDescription>{t("assignSources.subtitlePar")}</CardDescription>
        </CardHeader>
      </Card>

      {(sources.isPending || comptes.isPending) && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}
      {sources.data && principaux.length === 0 && <EmptyState title={t("assignSources.vide")} />}

      {langues.map((l) => (
        <FileLangue
          key={l}
          langue={l}
          sources={principaux}
          pris={prisParLangue.get(l) ?? new Set()}
        />
      ))}
    </div>
  );
}
