import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw, RotateCcw, Scissors, Settings2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { aujourdhuiParis, ecrireReglage, lireReglages } from "@/features/moteur/api";
import {
  assignerPapierCm,
  lancerPapierJour,
  lancerPapierLocales,
  listerPapierMasters,
  regenererPapier,
  relancerPapier,
  relancerPapierLangue,
  type PapierLangue,
  type PapierLangueStatut,
  type PapierMaster,
  type PapierStatut,
} from "@/features/moteur/api";
import { drapeauLangue, nomLangue } from "@/features/moteur/langues";
import { REGLAGES_PAPIER_DEFAUT } from "@/features/moteur/papierReglages";

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
      const busy = rows.some(
        (m) =>
          ["queued", "scripting", "images", "clips"].includes(m.statut) ||
          (m.papier_langues ?? []).some((l) =>
            ["queued", "translating", "voice", "mix", "render", "karaoke"].includes(l.statut),
          ),
      );
      return busy ? 4000 : false;
    },
  });

  const reglages = useQuery({ queryKey: ["reglages"], queryFn: lireReglages });
  const today = (liste.data ?? []).find((m) => m.date_publication === jour) ?? null;
  const papier = reglages.data?.papier;
  const falUsage =
    reglages.data?.papier_fal_usage.date === jour ? reglages.data.papier_fal_usage.appels : 0;

  React.useEffect(() => {
    if (today?.topic && !topic) setTopic(today.topic);
  }, [today?.topic, topic]);

  function invalider() {
    void queryClient.invalidateQueries({ queryKey: ["papier-masters"] });
    void queryClient.invalidateQueries({ queryKey: ["reglages"] });
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
  const locales = useMutation({
    mutationFn: (masterId: string) => lancerPapierLocales(masterId),
    onSuccess: invalider,
  });
  const relancerLangue = useMutation({
    mutationFn: (id: string) => relancerPapierLangue(id),
    onSuccess: invalider,
  });
  const assigner = useMutation({
    mutationFn: (masterId: string) => assignerPapierCm({ masterId }),
    onSuccess: invalider,
  });
  const pause = useMutation({
    mutationFn: (actif: boolean) =>
      ecrireReglage("papier", { ...REGLAGES_PAPIER_DEFAUT, ...papier, actif }),
    onSuccess: invalider,
  });

  const busy =
    lancer.isPending ||
    relancer.isPending ||
    regenerer.isPending ||
    locales.isPending ||
    relancerLangue.isPending ||
    assigner.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("papier.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("papier.subtitle")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Link to="/admin/reglages#papier" className="inline-flex items-center gap-1 text-primary">
            <Settings2 className="h-3.5 w-3.5" />
            {t("papier.reglagesLien")}
          </Link>
          {papier ? (
            <span>
              {papier.fal_quota_jour <= 0
                ? t("papier.quotaFalIllimite", { n: falUsage })
                : t("papier.quotaFal", { n: falUsage, max: papier.fal_quota_jour })}
            </span>
          ) : null}
        </div>
      </div>

      {papier && !papier.actif ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2">
          <p className="text-sm text-warning-foreground">{t("papier.enPause")}</p>
          <Button size="sm" variant="outline" disabled={pause.isPending} onClick={() => pause.mutate(true)}>
            {t("minuit.pauseOff")}
          </Button>
        </div>
      ) : papier ? (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" disabled={pause.isPending} onClick={() => pause.mutate(false)}>
            {t("reglages.papierPause")}
          </Button>
        </div>
      ) : null}

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
          {today?.statut === "ready" ? (
            <Button variant="outline" onClick={() => locales.mutate(today.id)} disabled={busy}>
              {locales.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("papier.avancerLangues")}
            </Button>
          ) : null}
          {today && (today.papier_langues ?? []).some((l) => l.statut === "ready") ? (
            <div className="space-y-1">
              <Button variant="outline" onClick={() => assigner.mutate(today.id)} disabled={busy}>
                {assigner.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("papier.assigner")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("papier.assignerAide")}
                {today.papier_posts?.length
                  ? ` · ${t("papier.assignes", { count: today.papier_posts.length })}`
                  : ""}
              </p>
            </div>
          ) : null}
          {lancer.error || relancer.error || regenerer.error || locales.error || assigner.error ? (
            <p className="text-sm text-destructive">
              {(lancer.error ?? relancer.error ?? regenerer.error ?? locales.error ?? assigner.error)?.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {today ? <CartesScenes master={today} /> : null}
      {today ? (
        <CartesLangues
          master={today}
          onRelancer={(id) => relancerLangue.mutate(id)}
          busy={busy}
        />
      ) : null}

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

const LANGUE_VARIANT: Record<
  PapierLangueStatut,
  "default" | "secondary" | "destructive" | "outline"
> = {
  queued: "outline",
  translating: "secondary",
  voice: "secondary",
  mix: "secondary",
  render: "secondary",
  karaoke: "secondary",
  ready: "default",
  failed: "destructive",
};

function CartesLangues({
  master,
  onRelancer,
  busy,
}: {
  master: PapierMaster;
  onRelancer: (id: string) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const langues = master.papier_langues ?? [];
  if (!langues.length && master.statut !== "ready") return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("papier.langues")}</CardTitle>
        <CardDescription>{t("papier.languesAide")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {langues.map((l) => (
          <CarteLangue key={l.id} langue={l} onRelancer={onRelancer} busy={busy} />
        ))}
      </CardContent>
    </Card>
  );
}

function CarteLangue({
  langue,
  onRelancer,
  busy,
}: {
  langue: PapierLangue;
  onRelancer: (id: string) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const video = langue.video_url || langue.video_mix_url;
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="aspect-[9/16] bg-muted">
        {video ? (
          <video src={video} className="h-full w-full object-cover" controls playsInline />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
            {t(`papier.statutLangue.${langue.statut}`)}
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {drapeauLangue(langue.langue)} {nomLangue(langue.langue)}
          </span>
          <Badge variant={LANGUE_VARIANT[langue.statut]}>
            {t(`papier.statutLangue.${langue.statut}`)}
          </Badge>
        </div>
        {langue.title ? <p className="text-xs text-muted-foreground">{langue.title}</p> : null}
        {langue.erreur ? <p className="text-xs text-destructive">{langue.erreur}</p> : null}
        {langue.statut === "failed" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onRelancer(langue.id)}>
            {t("papier.relancerLangue")}
          </Button>
        ) : null}
      </div>
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
