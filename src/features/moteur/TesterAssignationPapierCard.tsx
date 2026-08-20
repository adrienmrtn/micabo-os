import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FlaskConical, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  annulerAssignationPapierTest,
  aujourdhuiParis,
  listerComptes,
  listerPapierPostsTest,
  testerAssignationPapier,
} from "@/features/moteur/api";
import { estCompteCm } from "@/features/moteur/comptesCm";
import { drapeauLangue, nomLangue } from "@/features/moteur/langues";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Tire au hasard un master FR inutilisé dans la langue d'UN compte CM, en `est_test`.
 * Invisible sur les calendriers. Annuler retire uniquement les lignes test.
 */
export function TesterAssignationPapierCard({ nu = false }: { nu?: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const comptes = useQuery({ queryKey: ["comptes"], queryFn: listerComptes });
  const cms = (comptes.data ?? []).filter(estCompteCm);
  const [compteId, setCompteId] = React.useState("");
  const date = aujourdhuiParis();

  const tests = useQuery({
    queryKey: ["papier-posts-test", compteId, date],
    queryFn: () => listerPapierPostsTest(compteId, date),
    enabled: Boolean(compteId),
  });

  function invalider() {
    void queryClient.invalidateQueries({ queryKey: ["papier-posts-test"] });
    void queryClient.invalidateQueries({ queryKey: ["papier-masters"] });
  }

  const lancer = useMutation({
    mutationFn: () => testerAssignationPapier({ compteId, date }),
    onSuccess: invalider,
  });
  const annuler = useMutation({
    mutationFn: () => annulerAssignationPapierTest(compteId, date),
    onSuccess: invalider,
  });

  const compte = cms.find((c) => c.id === compteId);
  const posts = tests.data ?? lancer.data?.posts ?? [];

  const corps = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sim-papier-compte">{t("simPapier.compte")}</Label>
        <select
          id="sim-papier-compte"
          className={selectClass}
          value={compteId}
          onChange={(e) => setCompteId(e.target.value)}
        >
          <option value="">{t("simPapier.comptePh")}</option>
          {cms.map((c) => (
            <option key={c.id} value={c.id}>
              {drapeauLangue(c.langue)} {nomLangue(c.langue)}
              {c.handle_tiktok ? ` @${c.handle_tiktok}` : ""}
              {c.persona_nom ? ` — ${c.persona_nom}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={!compteId || lancer.isPending} onClick={() => lancer.mutate()}>
          {lancer.isPending ? t("simPapier.enCours") : t("simPapier.lancer")}
        </Button>
        <Button
          variant="outline"
          disabled={!compteId || annuler.isPending || posts.length === 0}
          onClick={() => {
            if (window.confirm(t("simPapier.annulerConfirm"))) annuler.mutate();
          }}
        >
          <RotateCcw className="size-3.5" />
          {annuler.isPending ? t("simPapier.annulerEnCours") : t("simPapier.annuler")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t("simPapier.aide")}</p>

      {lancer.isError && (
        <p className="text-sm text-destructive">{(lancer.error as Error).message}</p>
      )}
      {annuler.isError && (
        <p className="text-sm text-destructive">{(annuler.error as Error).message}</p>
      )}
      {lancer.isSuccess && (
        <p className="text-sm text-muted-foreground">
          {lancer.data.assigns
            ? t("simPapier.ok", { count: lancer.data.assigns })
            : lancer.data.detail || t("simPapier.aucun")}
        </p>
      )}
      {annuler.isSuccess && (
        <p className="text-sm text-muted-foreground">
          {t("simPapier.annuleOk", { count: annuler.data.supprimes ?? 0 })}
        </p>
      )}

      {posts.map((post) => (
        <div key={post.id} className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">
            {post.title ?? t("cm.videoDuJour")}
            {compte ? ` · ${drapeauLangue(compte.langue)}` : ""}
          </p>
          {post.video_url ? (
            <video src={post.video_url} className="max-h-72 w-full rounded-md bg-muted" controls playsInline />
          ) : null}
          {post.caption ? (
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">{post.caption}</p>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <a href={post.video_url} download target="_blank" rel="noreferrer">
              {t("cm.telecharger")}
            </a>
          </Button>
        </div>
      ))}
    </div>
  );

  if (nu) return corps;
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" />
          {t("simPapier.title")}
        </CardTitle>
        <CardDescription>{t("simPapier.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>{corps}</CardContent>
    </Card>
  );
}
