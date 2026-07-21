import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ecrireReglage, lireReglages } from "@/features/moteur/api";
import type { Reglages } from "@/features/moteur/types";

function ChampNombre({
  id,
  label,
  valeur,
  onChange,
  min = 0,
}: {
  id: string;
  label: string;
  valeur: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function AdminReglagesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["reglages"], queryFn: lireReglages });

  const [brouillon, setBrouillon] = React.useState<Reglages | null>(null);
  const reglages = brouillon ?? data ?? null;

  const enregistrer = useMutation({
    mutationFn: async (r: Reglages) => {
      await ecrireReglage("repartition", r.repartition);
      await ecrireReglage("frequence", r.frequence);
      await ecrireReglage("semaine1", r.semaine1);
    },
    onSuccess: () => {
      setBrouillon(null);
      queryClient.invalidateQueries({ queryKey: ["reglages"] });
    },
  });

  if (isPending || !reglages) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  const maj = (patch: Partial<Reglages>) => setBrouillon({ ...reglages, ...patch });
  const total =
    reglages.repartition.recycle + reglages.repartition.remanie + reglages.repartition.nouveau;
  const totalValide = total === 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("reglages.title")}</CardTitle>
        <CardDescription>{t("reglages.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-medium">{t("reglages.repartition")}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <ChampNombre
              id="recycle"
              label={t("reglages.recycle")}
              valeur={reglages.repartition.recycle}
              onChange={(n) =>
                maj({ repartition: { ...reglages.repartition, recycle: n } })
              }
            />
            <ChampNombre
              id="remanie"
              label={t("reglages.remanie")}
              valeur={reglages.repartition.remanie}
              onChange={(n) =>
                maj({ repartition: { ...reglages.repartition, remanie: n } })
              }
            />
            <ChampNombre
              id="nouveau"
              label={t("reglages.nouveau")}
              valeur={reglages.repartition.nouveau}
              onChange={(n) =>
                maj({ repartition: { ...reglages.repartition, nouveau: n } })
              }
            />
          </div>
          <p className={totalValide ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
            {totalValide ? t("reglages.total", { total }) : t("reglages.totalInvalide")}
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">{t("reglages.frequence")}</h3>
          <div className="sm:max-w-xs">
            <ChampNombre
              id="parJour"
              label={t("reglages.postsParJour")}
              min={1}
              valeur={reglages.frequence.posts_par_jour}
              onChange={(n) => maj({ frequence: { posts_par_jour: n } })}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">{t("reglages.semaine1")}</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reglages.semaine1.actif}
              onChange={(e) =>
                maj({ semaine1: { ...reglages.semaine1, actif: e.target.checked } })
              }
            />
            {t("reglages.semaine1Actif")}
          </label>

          {reglages.semaine1.actif && (
            <div className="grid gap-4 sm:grid-cols-3">
              <ChampNombre
                id="s1jours"
                label={t("reglages.semaine1Jours")}
                min={1}
                valeur={reglages.semaine1.jours}
                onChange={(n) => maj({ semaine1: { ...reglages.semaine1, jours: n } })}
              />
              <ChampNombre
                id="s1posts"
                label={t("reglages.semaine1Posts")}
                min={1}
                valeur={reglages.semaine1.posts_par_jour}
                onChange={(n) =>
                  maj({ semaine1: { ...reglages.semaine1, posts_par_jour: n } })
                }
              />
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={reglages.semaine1.tout_recycle}
                  onChange={(e) =>
                    maj({ semaine1: { ...reglages.semaine1, tout_recycle: e.target.checked } })
                  }
                />
                {t("reglages.semaine1Recycle")}
              </label>
            </div>
          )}
        </section>

        <div className="flex items-center gap-3">
          <Button
            disabled={!brouillon || !totalValide || enregistrer.isPending}
            onClick={() => enregistrer.mutate(reglages)}
          >
            {enregistrer.isPending ? t("common.saving") : t("common.save")}
          </Button>
          {enregistrer.isError && (
            <p className="text-sm text-destructive">{(enregistrer.error as Error).message}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
