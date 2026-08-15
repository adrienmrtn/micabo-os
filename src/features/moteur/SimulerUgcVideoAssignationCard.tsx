import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FlaskConical, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listerLabelsUgcAiVideo } from "@/features/moteur/api";
import { listerUgcReactions } from "@/features/ugc/api";
import {
  compteCorrespondFiltre,
  libelleCompteTestLibre,
  reactionCorrespondFiltre,
  reactionPretPourFaceSwap,
  trierComptesTestLibre,
} from "./libelleCompteTestLibre";
import {
  annulerAssignationUgcVideoTest,
  aujourdhuiParis,
  lancerAssignationUgcVideoTest,
  listerComptes,
  listerTousComptesPourTest,
  listerUgcVideoPostsTest,
  type AssignationTestLog,
} from "./api";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type Mode = "complet" | "face_ref" | "libre";

type Props = {
  /** `face_ref` = étapes 0–2. `libre` = tous les comptes + reaction choisie. */
  mode?: Mode;
};

function i18nKeyFor(mode: Mode): "simUgcVideoFace" | "simUgcVideoLibre" | "simUgcVideo" {
  if (mode === "face_ref") return "simUgcVideoFace";
  if (mode === "libre") return "simUgcVideoLibre";
  return "simUgcVideo";
}

/** Test assignation UGC AI VIDEO — logs NDJSON exacts. */
export function SimulerUgcVideoAssignationCard({ mode = "complet" }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const libre = mode === "libre";
  const comptes = useQuery({
    queryKey: libre ? ["comptes-test-tous"] : ["comptes"],
    queryFn: libre ? listerTousComptesPourTest : listerComptes,
  });
  const reactionsQ = useQuery({
    queryKey: ["ugc-reactions"],
    queryFn: async () => (await listerUgcReactions()).reactions,
    enabled: libre,
  });
  const labelsUgc = useQuery({
    queryKey: ["labels-ugc-ai-video"],
    queryFn: () => listerLabelsUgcAiVideo(),
    enabled: libre,
  });
  const [date, setDate] = React.useState(aujourdhuiParis());
  const [compteId, setCompteId] = React.useState("");
  const [reactionId, setReactionId] = React.useState("");
  const [filtreCompte, setFiltreCompte] = React.useState("");
  const [filtreReaction, setFiltreReaction] = React.useState("");
  const [logs, setLogs] = React.useState<AssignationTestLog[]>([]);
  const logsRef = React.useRef<HTMLDivElement>(null);
  const i18nKey = i18nKeyFor(mode);

  const videoComptes = React.useMemo(
    () => (comptes.data ?? []).filter((c) => c.ugc_ai_video),
    [comptes.data],
  );

  const comptesLibre = React.useMemo(() => {
    const tries = trierComptesTestLibre(comptes.data ?? []);
    return tries.filter((c) => compteCorrespondFiltre(c, filtreCompte));
  }, [comptes.data, filtreCompte]);

  const labelNom = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const l of labelsUgc.data ?? []) m.set(l.id, l.nom);
    return m;
  }, [labelsUgc.data]);

  const reactionsPret = React.useMemo(() => {
    const pret = (reactionsQ.data ?? []).filter(reactionPretPourFaceSwap);
    return pret.filter((r) =>
      reactionCorrespondFiltre(
        { id: r.id, titre: r.titre, labelNom: r.label_id ? labelNom.get(r.label_id) ?? null : null },
        filtreReaction,
      ),
    );
  }, [reactionsQ.data, filtreReaction, labelNom]);

  const compteChoisi = React.useMemo(
    () => (comptes.data ?? []).find((c) => c.id === compteId) ?? null,
    [comptes.data, compteId],
  );
  const reactionChoisie = React.useMemo(
    () => (reactionsQ.data ?? []).find((r) => r.id === reactionId) ?? null,
    [reactionsQ.data, reactionId],
  );
  const sansPersona = Boolean(libre && compteChoisi && !compteChoisi.ugc_persona_id);

  React.useEffect(() => {
    if (!logsRef.current) return;
    logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs.length]);

  const assigner = useMutation({
    mutationFn: () => {
      setLogs([]);
      return lancerAssignationUgcVideoTest(
        date,
        compteId,
        (ligne) => {
          setLogs((prev) => [...prev, ligne]);
        },
        {
          jusquA: mode === "face_ref" ? "face_ref" : "complet",
          ...(libre && reactionId ? { reactionId } : {}),
        },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ugc-video-posts-test"] });
    },
  });

  const annuler = useMutation({
    mutationFn: () => annulerAssignationUgcVideoTest(date, compteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ugc-video-posts-test"] });
    },
  });

  const posts = useQuery({
    queryKey: ["ugc-video-posts-test", mode, compteId, date],
    queryFn: () => listerUgcVideoPostsTest(compteId, date),
    enabled: Boolean(compteId && date),
  });

  const crees = assigner.data?.crees ?? 0;
  const raison =
    assigner.data?.resultats?.[0]?.erreur ??
    assigner.data?.resultats?.[0]?.raison ??
    null;

  const peutLancer =
    Boolean(compteId && date) &&
    (!libre || Boolean(reactionId)) &&
    !sansPersona &&
    !assigner.isPending &&
    !annuler.isPending;

  const optionsComptes = libre ? comptesLibre : videoComptes;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" />
          {t(`${i18nKey}.title`)}
        </CardTitle>
        <CardDescription>{t(`${i18nKey}.subtitle`)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`ugcVideoDate-${mode}`}>{t(`${i18nKey}.date`)}</Label>
            <Input
              id={`ugcVideoDate-${mode}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`ugcVideoCompte-${mode}`}>{t(`${i18nKey}.compte`)}</Label>
            {libre && (
              <Input
                id={`ugcVideoCompteFiltre-${mode}`}
                value={filtreCompte}
                onChange={(e) => setFiltreCompte(e.target.value)}
                placeholder={t(`${i18nKey}.filtreCompte`)}
              />
            )}
            <select
              id={`ugcVideoCompte-${mode}`}
              className={selectClass}
              value={compteId}
              onChange={(e) => setCompteId(e.target.value)}
            >
              <option value="">{t("common.none")}</option>
              {optionsComptes.map((c) => (
                <option key={c.id} value={c.id}>
                  {libre
                    ? libelleCompteTestLibre(c, {
                        actif: t("simUgcVideoLibre.actif"),
                        inactif: t("simUgcVideoLibre.inactif"),
                        ugcVideo: t("simUgcVideoLibre.flagVideo"),
                        ugcSlideshow: t("simUgcVideoLibre.flagSlideshow"),
                        pasUgc: t("simUgcVideoLibre.flagPasUgc"),
                        sansPersona: t("simUgcVideoLibre.sansPersona"),
                      })
                    : `${c.persona_nom ?? c.handle_tiktok ?? c.id.slice(0, 8)}${
                        c.langue ? ` · ${c.langue}` : ""
                      } · UGC VIDEO`}
                </option>
              ))}
            </select>
            {libre && (
              <p className="text-[11px] text-muted-foreground">
                {t("simUgcVideoLibre.comptesCount", {
                  n: comptesLibre.length,
                  total: comptes.data?.length ?? 0,
                })}
              </p>
            )}
          </div>
        </div>

        {libre && (
          <div className="space-y-2">
            <Label htmlFor={`ugcVideoReaction-${mode}`}>{t("simUgcVideoLibre.reaction")}</Label>
            <Input
              id={`ugcVideoReactionFiltre-${mode}`}
              value={filtreReaction}
              onChange={(e) => setFiltreReaction(e.target.value)}
              placeholder={t("simUgcVideoLibre.filtreReaction")}
            />
            <select
              id={`ugcVideoReaction-${mode}`}
              className={selectClass}
              value={reactionId}
              onChange={(e) => setReactionId(e.target.value)}
            >
              <option value="">{t("common.none")}</option>
              {reactionsPret.map((r) => {
                const lab = r.label_id ? labelNom.get(r.label_id) : null;
                return (
                  <option key={r.id} value={r.id}>
                    {r.titre?.trim() || r.id.slice(0, 8)}
                    {lab ? ` · ${lab}` : ""}
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-muted-foreground">
              {t("simUgcVideoLibre.reactionsCount", { n: reactionsPret.length })}
            </p>
            {reactionChoisie && (
              <div className="flex flex-wrap items-start gap-3 rounded-md border p-3">
                {reactionChoisie.first_frame_reference_url && (
                  <img
                    src={reactionChoisie.first_frame_reference_url}
                    alt=""
                    className="max-h-36 rounded border object-contain"
                  />
                )}
                {reactionChoisie.video_source_url && (
                  <video
                    src={reactionChoisie.video_source_url}
                    controls
                    className="aspect-[9/16] max-h-36 w-auto rounded border"
                  />
                )}
                <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {reactionChoisie.titre?.trim() || reactionChoisie.id.slice(0, 8)}
                  </p>
                  <p>
                    {reactionChoisie.label_id
                      ? labelNom.get(reactionChoisie.label_id) ?? reactionChoisie.label_id.slice(0, 8)
                      : "—"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {sansPersona && (
          <p className="rounded-md bg-warning/10 p-3 text-sm text-warning">
            {t("simUgcVideoLibre.personaRequis")}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!peutLancer}
            onClick={() => assigner.mutate()}
          >
            {assigner.isPending ? t(`${i18nKey}.enCours`) : t(`${i18nKey}.lancer`)}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!compteId || !date || annuler.isPending || assigner.isPending}
            onClick={() => {
              if (window.confirm(t(`${i18nKey}.annulerConfirm`))) annuler.mutate();
            }}
          >
            <RotateCcw className="mr-2 size-4" />
            {annuler.isPending ? t(`${i18nKey}.annulerEnCours`) : t(`${i18nKey}.annuler`)}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{t(`${i18nKey}.aide`)}</p>

        {(assigner.isPending || logs.length > 0) && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t(`${i18nKey}.logs`)}
              {assigner.isPending ? ` — ${t(`${i18nKey}.enCours`)}` : ""}
            </p>
            <div
              ref={logsRef}
              className="max-h-72 overflow-y-auto rounded-md border bg-muted/20 p-2 font-mono text-[11px] leading-relaxed"
            >
              {logs.length === 0 && assigner.isPending && (
                <p className="text-muted-foreground">{t(`${i18nKey}.logsAttente`)}</p>
              )}
              {logs.map((l, i) => (
                <p
                  key={`${l.at}-${i}`}
                  className={cn(
                    l.statut === "echec" && "text-destructive",
                    l.statut === "ok" && "text-emerald-700 dark:text-emerald-400",
                  )}
                >
                  <span className="text-muted-foreground">
                    {new Date(l.at).toLocaleTimeString()}
                  </span>{" "}
                  {l.detail}
                </p>
              ))}
            </div>
          </div>
        )}

        {assigner.isSuccess && (
          <div
            className={
              crees === 0
                ? "rounded-md bg-warning/10 p-3 text-sm text-warning"
                : "rounded-md bg-success/10 p-3 text-sm text-success"
            }
          >
            {crees === 0
              ? raison ?? t(`${i18nKey}.aucun`)
              : t(`${i18nKey}.ok`, { crees })}
          </div>
        )}

        {(posts.data ?? []).length > 0 && (
          <div className="space-y-3">
            {(posts.data ?? []).map((p) => (
              <div key={p.id} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="font-medium">{p.statut}</span>
                  <span className="text-muted-foreground">{p.id.slice(0, 8)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.frame_clean_url && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">frame10 clean</p>
                      <img
                        src={p.frame_clean_url}
                        alt=""
                        className="max-h-40 rounded border object-contain"
                      />
                    </div>
                  )}
                  {p.image_ref_url && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">face-ref</p>
                      <img
                        src={p.image_ref_url}
                        alt=""
                        className="max-h-40 rounded border object-contain"
                      />
                    </div>
                  )}
                </div>
                {mode !== "face_ref" && p.video_kling_url && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">kling</p>
                    <video
                      src={p.video_kling_url}
                      controls
                      className="aspect-[9/16] max-h-64 w-auto rounded border"
                    />
                  </div>
                )}
                {mode !== "face_ref" && p.video_finale_url && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">finale (kling + utilisation)</p>
                    <video
                      src={p.video_finale_url}
                      controls
                      className="aspect-[9/16] max-h-64 w-auto rounded border"
                    />
                  </div>
                )}
                {mode !== "face_ref" && p.caption && (
                  <pre className="whitespace-pre-wrap rounded border bg-background p-2 text-xs">
                    {p.caption}
                  </pre>
                )}
                {p.pipeline_erreur && (
                  <p className="text-xs text-destructive">{p.pipeline_erreur}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {assigner.isError && (
          <p className="text-sm text-destructive">{(assigner.error as Error).message}</p>
        )}
        {annuler.isSuccess && (
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            {t(`${i18nKey}.annuleOk`, { posts: annuler.data.posts })}
          </div>
        )}
        {annuler.isError && (
          <p className="text-sm text-destructive">{(annuler.error as Error).message}</p>
        )}
      </CardContent>
    </Card>
  );
}
