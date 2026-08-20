import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Library,
  Loader2,
  Moon,
  RefreshCw,
  RotateCcw,
  Scissors,
  Settings2,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { aujourdhuiParis, ecrireReglage, lireReglages } from "@/features/moteur/api";
import {
  assignerPapierCm,
  changerVoixPapier,
  lancerPapierJour,
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
import { REGLAGES_PAPIER_DEFAUT, VOIX_PAPIER } from "@/features/moteur/papierReglages";
import { TesterAssignationPapierCard } from "@/features/moteur/TesterAssignationPapierCard";
import { cn } from "@/lib/utils";

const STATUT_VARIANT: Record<PapierStatut, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  scripting: "secondary",
  images: "secondary",
  clips: "secondary",
  ready: "default",
  failed: "destructive",
};

function masterEnCours(m: PapierMaster): boolean {
  return !["ready", "failed"].includes(m.statut);
}

function videoFrDe(master: PapierMaster): string | null {
  return (
    master.video_url ||
    master.papier_langues?.find((l) => l.langue === "fr" && l.video_url)?.video_url ||
    null
  );
}

function languesConsommees(master: PapierMaster): string[] {
  return [...new Set((master.papier_posts ?? []).map((p) => p.langue))].sort();
}

function vignetteMaster(master: PapierMaster): string | null {
  return (
    videoFrDe(master) ||
    master.papier_scenes?.find((s) => s.clip_url)?.clip_url ||
    master.papier_scenes?.find((s) => s.image_url)?.image_url ||
    null
  );
}

export function AdminPapierPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const jour = aujourdhuiParis();
  const [topic, setTopic] = React.useState("");
  const [voix, setVoix] = React.useState("");
  const [selectionId, setSelectionId] = React.useState<string | null>(null);

  const liste = useQuery({
    queryKey: ["papier-masters"],
    queryFn: () => listerPapierMasters(60),
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
  const rows = liste.data ?? [];
  const enCours = rows.find(masterEnCours) ?? null;
  const biblio = rows.filter((m) => m.statut === "ready" && Boolean(m.video_url || videoFrDe(m)));
  const failed = rows.filter((m) => m.statut === "failed");
  const papier = reglages.data?.papier;
  const falUsage =
    reglages.data?.papier_fal_usage.date === jour ? reglages.data.papier_fal_usage.appels : 0;

  React.useEffect(() => {
    if (enCours?.topic && !topic) setTopic(enCours.topic);
  }, [enCours?.topic, topic]);

  React.useEffect(() => {
    if (enCours?.voice) setVoix(enCours.voice);
    else if (papier?.voix && !voix) setVoix(papier.voix);
  }, [enCours?.voice, papier?.voix, voix]);

  function invalider() {
    void queryClient.invalidateQueries({ queryKey: ["papier-masters"] });
    void queryClient.invalidateQueries({ queryKey: ["reglages"] });
  }

  const lancer = useMutation({
    mutationFn: () =>
      lancerPapierJour({
        date: jour,
        topic: topic.trim() || undefined,
        voice: voix || undefined,
      }),
    onSuccess: invalider,
  });
  const changerVoix = useMutation({
    mutationFn: ({ id, voice }: { id: string; voice: string }) => changerVoixPapier(id, voice),
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
  const relancerLangue = useMutation({
    mutationFn: (id: string) => relancerPapierLangue(id),
    onSuccess: invalider,
  });
  const assigner = useMutation({
    mutationFn: () => assignerPapierCm({}),
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
    relancerLangue.isPending ||
    assigner.isPending ||
    changerVoix.isPending;

  const erreur = lancer.error ?? relancer.error ?? regenerer.error ?? assigner.error ?? changerVoix.error;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-xl font-semibold tracking-tight">{t("papier.title")}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t("papier.subtitle")}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
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
        {papier ? (
          <Button
            size="sm"
            variant={papier.actif ? "ghost" : "outline"}
            disabled={pause.isPending}
            onClick={() => pause.mutate(!papier.actif)}
          >
            {papier.actif ? t("reglages.papierPause") : t("minuit.pauseOff")}
          </Button>
        ) : null}
      </header>

      {papier && !papier.actif ? (
        <div className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          {t("papier.enPause")}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Library className="h-4 w-4" />
              {t("papier.historique")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("papier.biblioAide", { n: biblio.length })}
            </p>
          </div>
        </div>

        {liste.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : biblio.length === 0 ? (
          <EmptyState
            icon={<Library className="h-5 w-5" />}
            title={t("papier.vide")}
            description={t("papier.videAide")}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {biblio.map((m) => (
              <CarteBiblio
                key={m.id}
                master={m}
                ouvert={selectionId === m.id}
                onToggle={() => setSelectionId((id) => (id === m.id ? null : m.id))}
                onRelancerLangue={(id) => relancerLangue.mutate(id)}
                onVoix={(voice) => changerVoix.mutate({ id: m.id, voice })}
                busy={busy}
              />
            ))}
          </div>
        )}
      </section>

      {enCours ? (
        <BlocRetractable
          ouvertDefaut
          icone={<Scissors className="h-4 w-4" />}
          titre={t("papier.aujourdHui")}
          sous={t("papier.aujourdHuiAide")}
          badge={
            <Badge variant={STATUT_VARIANT[enCours.statut]}>{t(`papier.statut.${enCours.statut}`)}</Badge>
          }
        >
          <ResumeMaster master={enCours} />
          <FormulairePipeline
            topic={topic}
            onTopic={setTopic}
            voix={enCours.voice || voix}
            onVoix={(v) => {
              setVoix(v);
              changerVoix.mutate({ id: enCours.id, voice: v });
            }}
            onAvancer={() => lancer.mutate()}
            onRelancer={enCours.statut === "failed" ? () => relancer.mutate(enCours.id) : undefined}
            onRegenerer={() => regenerer.mutate(enCours.id)}
            busy={busy}
            lancerPending={lancer.isPending}
          />
          <SousBloc titre={t("papier.voirPlans")} compte={enCours.papier_scenes?.length ?? 0}>
            <CartesScenes master={enCours} />
          </SousBloc>
          {(enCours.papier_langues ?? []).length ? (
            <SousBloc titre={t("papier.voirLangues")} compte={enCours.papier_langues?.length ?? 0}>
              <CartesLangues
                master={enCours}
                onRelancer={(id) => relancerLangue.mutate(id)}
                busy={busy}
              />
            </SousBloc>
          ) : null}
        </BlocRetractable>
      ) : (
        <BlocRetractable
          ouvertDefaut={biblio.length === 0}
          icone={<Sparkles className="h-4 w-4" />}
          titre={t("papier.nouveauMaster")}
          sous={t("papier.nouveauMasterAide")}
        >
          <FormulairePipeline
            topic={topic}
            onTopic={setTopic}
            voix={voix || papier?.voix || "George"}
            onVoix={setVoix}
            onAvancer={() => lancer.mutate()}
            busy={busy}
            lancerPending={lancer.isPending}
          />
        </BlocRetractable>
      )}

      {failed.length ? (
        <BlocRetractable
          icone={<RefreshCw className="h-4 w-4" />}
          titre={t("papier.echecs")}
          sous={t("papier.nMasters", { count: failed.length })}
        >
          <div className="space-y-2">
            {failed.map((m) => (
              <div key={m.id} className="space-y-2 rounded-md border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">
                    <span className="font-medium">{m.date_publication}</span>
                    {" — "}
                    {m.topic || t("papier.sansTopic")}
                  </span>
                  <Badge variant="destructive">{t("papier.statut.failed")}</Badge>
                </div>
                {m.erreur ? <p className="text-xs text-destructive">{m.erreur}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => relancer.mutate(m.id)}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t("papier.relancer")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => regenerer.mutate(m.id)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t("papier.regenerer")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </BlocRetractable>
      ) : null}

      <BlocRetractable
        icone={<Moon className="h-4 w-4" />}
        titre={t("papier.minuit")}
        sous={t("papier.minuitAide")}
      >
        <div className="space-y-3">
          <Button variant="outline" onClick={() => assigner.mutate()} disabled={busy}>
            {assigner.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Moon className="h-4 w-4" />}
            {t("papier.assigner")}
          </Button>
          {assigner.isSuccess && assigner.data.detail ? (
            <p className="text-sm text-muted-foreground">{assigner.data.detail}</p>
          ) : null}
        </div>
      </BlocRetractable>

      <BlocRetractable titre={t("simPapier.title")} sous={t("simPapier.subtitle")}>
        <TesterAssignationPapierCard nu />
      </BlocRetractable>

      {erreur ? <p className="text-sm text-destructive">{erreur.message}</p> : null}
    </div>
  );
}

function BlocRetractable({
  titre,
  sous,
  icone,
  badge,
  ouvertDefaut = false,
  children,
}: {
  titre: string;
  sous?: string;
  icone?: React.ReactNode;
  badge?: React.ReactNode;
  ouvertDefaut?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [ouvert, setOuvert] = React.useState(ouvertDefaut);
  return (
    <Card>
      <button
        type="button"
        className="flex w-full items-start gap-3 p-5 text-left"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
      >
        {icone ? <span className="mt-0.5 text-muted-foreground">{icone}</span> : null}
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-semibold leading-tight">{titre}</span>
            {badge}
          </span>
          {sous ? <span className="block text-sm text-muted-foreground">{sous}</span> : null}
        </span>
        <ChevronDown
          className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", ouvert && "rotate-180")}
          aria-hidden
        />
        <span className="sr-only">{ouvert ? t("papier.fermer") : t("papier.ouvrir")}</span>
      </button>
      {ouvert ? <CardContent className="space-y-4">{children}</CardContent> : null}
    </Card>
  );
}

function SousBloc({
  titre,
  compte,
  children,
}: {
  titre: string;
  compte: number;
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = React.useState(false);
  if (!compte) return null;
  return (
    <div className="rounded-md border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
      >
        <span className="font-medium">
          {titre}
          <span className="ml-2 text-muted-foreground">· {compte}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", ouvert && "rotate-180")} />
      </button>
      {ouvert ? <div className="border-t p-3">{children}</div> : null}
    </div>
  );
}

function SelectVoix({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 sm:max-w-xs">
      <Label htmlFor={id}>{t("papier.voix")}</Label>
      <select
        id={id}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {VOIX_PAPIER.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">{t("papier.voixAide")}</p>
    </div>
  );
}

function FormulairePipeline({
  topic,
  onTopic,
  voix,
  onVoix,
  onAvancer,
  onRelancer,
  onRegenerer,
  busy,
  lancerPending,
}: {
  topic: string;
  onTopic: (v: string) => void;
  voix: string;
  onVoix: (v: string) => void;
  onAvancer: () => void;
  onRelancer?: () => void;
  onRegenerer?: () => void;
  busy: boolean;
  lancerPending: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="papier-topic">{t("papier.topic")}</Label>
        <Textarea
          id="papier-topic"
          value={topic}
          onChange={(e) => onTopic(e.target.value)}
          placeholder={t("papier.topicPh")}
          rows={2}
        />
      </div>
      <SelectVoix id="papier-voix" value={voix} onChange={onVoix} disabled={busy} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={onAvancer} disabled={busy}>
          {lancerPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {t("papier.avancer")}
        </Button>
        {onRelancer ? (
          <Button variant="outline" onClick={onRelancer} disabled={busy}>
            <RefreshCw className="h-4 w-4" />
            {t("papier.relancer")}
          </Button>
        ) : null}
        {onRegenerer ? (
          <Button variant="outline" onClick={onRegenerer} disabled={busy}>
            <RotateCcw className="h-4 w-4" />
            {t("papier.regenerer")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CarteBiblio({
  master,
  ouvert,
  onToggle,
  onRelancerLangue,
  onVoix,
  busy,
}: {
  master: PapierMaster;
  ouvert: boolean;
  onToggle: () => void;
  onRelancerLangue: (id: string) => void;
  onVoix: (voice: string) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const conso = languesConsommees(master);
  const vignette = vignetteMaster(master);
  const titre = master.script?.title || master.topic || t("papier.sansTopic");
  return (
    <Card className={cn("overflow-hidden", ouvert && "ring-1 ring-primary")}>
      <button type="button" className="flex w-full gap-3 p-3 text-left" onClick={onToggle} aria-expanded={ouvert}>
        <div className="relative h-28 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
          {vignette ? (
            vignette.endsWith(".png") || vignette.includes("/img-") ? (
              <img src={vignette} alt="" className="h-full w-full object-cover" />
            ) : (
              <video src={vignette} className="h-full w-full object-cover" muted playsInline preload="metadata" />
            )
          ) : null}
        </div>
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="block truncate font-medium leading-snug">{titre}</span>
          <span className="block text-xs text-muted-foreground">
            {master.date_publication}
            {master.voice ? ` · ${master.voice}` : ""}
          </span>
          <span className="flex flex-wrap items-center gap-1">
            {conso.length === 0 ? (
              <Badge variant="outline">{t("papier.libre")}</Badge>
            ) : (
              <>
                <span className="text-xs text-muted-foreground">{t("papier.consommees")}</span>
                {conso.map((l) => (
                  <span key={l} title={nomLangue(l)} className="text-sm">
                    {drapeauLangue(l)}
                  </span>
                ))}
              </>
            )}
          </span>
        </span>
        <ChevronDown
          className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", ouvert && "rotate-180")}
        />
      </button>
      {ouvert ? (
        <div className="space-y-3 border-t p-3">
          <ResumeMaster master={master} />
          <SelectVoix
            id={`papier-voix-${master.id}`}
            value={master.voice || "George"}
            onChange={onVoix}
            disabled={busy}
          />
          <SousBloc titre={t("papier.voirPlans")} compte={master.papier_scenes?.length ?? 0}>
            <CartesScenes master={master} />
          </SousBloc>
          <SousBloc titre={t("papier.voirLangues")} compte={master.papier_langues?.length ?? 0}>
            <CartesLangues master={master} onRelancer={onRelancerLangue} busy={busy} />
          </SousBloc>
        </div>
      ) : null}
    </Card>
  );
}

function ResumeMaster({ master }: { master: PapierMaster }) {
  const { t } = useTranslation();
  const pct = Math.round((master.progression ?? 0) * 100);
  const scenes = master.papier_scenes ?? [];
  const videoFr = videoFrDe(master);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUT_VARIANT[master.statut]}>{t(`papier.statut.${master.statut}`)}</Badge>
        <span className="text-sm text-muted-foreground">
          {t("papier.plans", { count: scenes.length })}
          {master.statut !== "ready" ? ` · ${pct}%` : ""}
        </span>
      </div>
      {master.statut !== "ready" ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {master.script?.title ? <p className="text-sm font-medium">{master.script.title}</p> : null}
      {videoFr ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("papier.videoFr")}</p>
          <video src={videoFr} className="max-h-80 w-full rounded-md bg-muted" controls playsInline />
        </div>
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
  const langues = master.papier_langues ?? [];
  if (!langues.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {langues.map((l) => (
        <CarteLangue key={l.id} langue={l} onRelancer={onRelancer} busy={busy} />
      ))}
    </div>
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
    <div className="grid gap-3 sm:grid-cols-2">
      {scenes.map((s) => (
        <div key={s.id} className="overflow-hidden rounded-md border">
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
          <div className="space-y-1 p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{t("papier.plan", { n: s.index + 1 })}</span>
              <span>{s.duree_cible}s</span>
            </div>
            {s.overlay ? <p className="text-xs font-medium">{s.overlay}</p> : null}
            <p className="text-sm leading-snug">{s.narration}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
