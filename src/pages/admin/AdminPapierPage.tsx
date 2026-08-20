import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw, RotateCcw, Scissors, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { aujourdhuiParis } from "@/features/moteur/api";
import {
  lancerPapierJour,
  listerPapierMasters,
  regenererPapier,
  relancerPapier,
  type PapierMaster,
  type PapierStatut,
} from "@/features/moteur/api";

const STATUT_VARIANT: Record<PapierStatut, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  scripting: "secondary",
  images: "secondary",
  clips: "secondary",
  ready: "default",
  failed: "destructive",
};

export function AdminPapierPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const jour = aujourdhuiParis();
  const [topic, setTopic] = React.useState("");

  const liste = useQuery({
    queryKey: ["papier-masters"],
    queryFn: () => listerPapierMasters(14),
    refetchInterval: (q) => {
      const rows = q.state.data ?? [];
      const busy = rows.some((m) =>
        ["queued", "scripting", "images", "clips"].includes(m.statut),
      );
      return busy ? 4000 : false;
    },
  });

  const today = (liste.data ?? []).find((m) => m.date_publication === jour) ?? null;

  React.useEffect(() => {
    if (today?.topic && !topic) setTopic(today.topic);
  }, [today?.topic, topic]);

  function invalider() {
    void queryClient.invalidateQueries({ queryKey: ["papier-masters"] });
  }

  const lancer = useMutation({
    mutationFn: () => lancerPapierJour({ date: jour, topic: topic.trim() || undefined }),
    onSuccess: invalider,
  });
  const relancer = useMutation({
    mutationFn: (id: string) => relancerPapier(id),
    onSuccess: invalider,
  });
  const regenerer = useMutation({
    mutationFn: (id: string) => regenererPapier(id, topic.trim() || undefined),
    onSuccess: invalider,
  });

  const busy =
    lancer.isPending || relancer.isPending || regenerer.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("papier.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("papier.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4" />
            {t("papier.aujourdHui", { date: jour })}
          </CardTitle>
          <CardDescription>{t("papier.aujourdHuiAide")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {today ? <ResumeMaster master={today} /> : (
            <p className="text-sm text-muted-foreground">{t("papier.aucunAujourdhui")}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="papier-topic">{t("papier.topic")}</Label>
            <Textarea
              id="papier-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t("papier.topicPh")}
              rows={2}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => lancer.mutate()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {today ? t("papier.avancer") : t("papier.generer")}
            </Button>
            {today && today.statut === "failed" ? (
              <Button variant="outline" onClick={() => relancer.mutate(today.id)} disabled={busy}>
                <RefreshCw className="h-4 w-4" />
                {t("papier.relancer")}
              </Button>
            ) : null}
            {today ? (
              <Button variant="outline" onClick={() => regenerer.mutate(today.id)} disabled={busy}>
                <RotateCcw className="h-4 w-4" />
                {t("papier.regenerer")}
              </Button>
            ) : null}
          </div>
          {lancer.error || relancer.error || regenerer.error ? (
            <p className="text-sm text-destructive">
              {(lancer.error ?? relancer.error ?? regenerer.error)?.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {today ? <CartesScenes master={today} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("papier.historique")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {liste.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (liste.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("papier.vide")}</p>
          ) : (
            (liste.data ?? []).map((m) => (
              <button
                key={m.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm"
                onClick={() => {
                  if (m.topic) setTopic(m.topic);
                }}
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{m.date_publication}</span>
                  {" — "}
                  <span className="text-muted-foreground">{m.topic || t("papier.sansTopic")}</span>
                </span>
                <Badge variant={STATUT_VARIANT[m.statut]}>{t(`papier.statut.${m.statut}`)}</Badge>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResumeMaster({ master }: { master: PapierMaster }) {
  const { t } = useTranslation();
  const pct = Math.round((master.progression ?? 0) * 100);
  const scenes = master.papier_scenes ?? [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUT_VARIANT[master.statut]}>{t(`papier.statut.${master.statut}`)}</Badge>
        <span className="text-sm text-muted-foreground">
          {t("papier.plans", { count: scenes.length })} · {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      {master.script?.title ? (
        <p className="text-sm font-medium">{master.script.title}</p>
      ) : null}
      {master.erreur ? <p className="text-sm text-destructive">{master.erreur}</p> : null}
    </div>
  );
}

function CartesScenes({ master }: { master: PapierMaster }) {
  const { t } = useTranslation();
  const scenes = master.papier_scenes ?? [];
  if (!scenes.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {scenes.map((s) => (
        <Card key={s.id} className="overflow-hidden">
          <div className="aspect-[9/16] bg-muted">
            {s.clip_url ? (
              <video src={s.clip_url} className="h-full w-full object-cover" controls muted playsInline />
            ) : s.image_url ? (
              <img src={s.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t("papier.planAttente")}
              </div>
            )}
          </div>
          <CardContent className="space-y-1 p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{t("papier.plan", { n: s.index + 1 })}</span>
              <span>{s.duree_cible}s</span>
            </div>
            {s.overlay ? <p className="text-xs font-medium">{s.overlay}</p> : null}
            <p className="text-sm leading-snug">{s.narration}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
