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

/**
 * Ordre d'assignation des comptes de référence : quand on crée un poster d'une
 * langue, il reçoit la source LIBRE (pas déjà prise dans cette langue) la plus
 * haute dans cet ordre. L'admin range la file ; un aperçu montre « qui vient
 * ensuite » par langue.
 */
export function AdminAssignationPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sources = useQuery({ queryKey: ["sources"], queryFn: listerSources });
  const comptes = useQuery({ queryKey: ["comptes"], queryFn: listerComptes });

  // Seuls les PRINCIPAUX sont assignables, rangés par ordre d'assignation.
  const principaux = React.useMemo(
    () =>
      (sources.data ?? [])
        .filter((s) => !s.parent_id && s.is_active)
        .slice()
        .sort(
          (a, b) =>
            (a.ordre_assignation ?? 9999) - (b.ordre_assignation ?? 9999) ||
            a.handle_tiktok.localeCompare(b.handle_tiktok),
        ),
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

  // Langues à afficher : celles des posters + celles des sources.
  const langues = React.useMemo(() => {
    const s = new Set<string>();
    for (const c of comptes.data ?? []) s.add(c.langue);
    for (const src of principaux) s.add(src.langue);
    return [...s].sort();
  }, [comptes.data, principaux]);

  // Échange l'ordre de deux sources adjacentes.
  const echanger = useMutation({
    mutationFn: async (v: { a: CompteReference; b: CompteReference }) => {
      const oa = v.a.ordre_assignation ?? 9999;
      const ob = v.b.ordre_assignation ?? 9998;
      await majSource(v.a.id, { ordre_assignation: ob });
      await majSource(v.b.id, { ordre_assignation: oa });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sources"] }),
  });

  const filePourLangue = (langue: string) =>
    principaux.filter((s) => !(prisParLangue.get(langue)?.has(s.id) ?? false));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="size-4 text-primary" />
            {t("assignSources.title")}
          </CardTitle>
          <CardDescription>{t("assignSources.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Aperçu « prochaine source » par langue. */}
          <div className="grid gap-2 sm:grid-cols-2">
            {langues.map((l) => {
              const file = filePourLangue(l);
              const prochaine = file[0];
              return (
                <div key={l} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{nomLangue(l)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {t("assignSources.libres", { count: file.length })}
                    </span>
                  </div>
                  <p className="pt-1.5 text-sm">
                    {prochaine ? (
                      <>
                        {t("assignSources.prochaine")}{" "}
                        <span className="font-semibold">@{prochaine.handle_tiktok}</span>
                      </>
                    ) : (
                      <span className="text-destructive">{t("assignSources.aucuneLibre")}</span>
                    )}
                  </p>
                  {file.length > 1 && (
                    <p className="truncate text-xs text-muted-foreground">
                      {t("assignSources.puis")} {file.slice(1, 4).map((s) => `@${s.handle_tiktok}`).join(", ")}
                      {file.length > 4 ? "…" : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("assignSources.ordreTitle")}</CardTitle>
          <CardDescription>{t("assignSources.ordreDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(sources.isPending || comptes.isPending) && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {!sources.isPending && principaux.length === 0 && (
            <EmptyState title={t("assignSources.vide")} />
          )}
          {principaux.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="truncate text-sm font-medium">@{s.handle_tiktok}</span>
                <Badge variant="outline">{nomLangue(s.langue)}</Badge>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={i === 0 || echanger.isPending}
                  onClick={() => echanger.mutate({ a: s, b: principaux[i - 1] })}
                  aria-label={t("assignSources.monter")}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={i === principaux.length - 1 || echanger.isPending}
                  onClick={() => echanger.mutate({ a: s, b: principaux[i + 1] })}
                  aria-label={t("assignSources.descendre")}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
