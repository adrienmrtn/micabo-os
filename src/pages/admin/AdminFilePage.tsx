import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditeurSlide, type EditeurSlideHandle } from "@/features/moteur/EditeurSlide";
import { LabelPicker } from "@/features/moteur/LabelPicker";
import {
  lireSlideshow,
  listerContenus,
  majTexteSlideDeck,
  setLabelsContenu,
  supprimerContenu,
  type ContenuListe,
  type SlideshowDetail,
} from "@/features/moteur/api";
import {
  definirFormatContenu,
  definirPlacementManuel,
  ecrireNoteFile,
  ecrireStructureSlides,
  listerBlocsPng,
  listerFormats,
  majChampsContenu,
  majHashtagsDeck,
  remplacerImagePropre,
  validerSlideshow,
} from "@/features/moteur/fileValidationApi";
import {
  deplacerSlide,
  retirerSlide,
  triees,
  type CalquePng,
} from "@/features/moteur/fileValidation";
import { PassagesSlideshow } from "@/features/moteur/PassagesSlideshow";
import { useApplication } from "@/features/moteur/ApplicationContext";
import { nomLangue } from "@/features/moteur/langues";
import { TIERS, type Tier } from "@/features/moteur/tierlist";
import type { ContenuSlide } from "@/features/moteur/types";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/** Une slide en cours de retouche : structure + calques posés, pas encore aplatis. */
interface SlideTravail {
  position: number;
  media_id: string | null;
  url: string | null;
  chemin: string | null;
  texte: string;
  calques: CalquePng[];
  /** L'image a été retouchée : il faudra l'aplatir à l'enregistrement. */
  sale: boolean;
}

function construireTravail(detail: SlideshowDetail): SlideTravail[] {
  const deck = detail.langues.find((l) => l.langue === detail.langue_source) ?? detail.langues[0];
  const texteParPos = new Map(
    ((deck?.slides ?? []) as Array<{ position: number; texte_overlay: string | null }>).map((s) => [
      s.position,
      s.texte_overlay ?? "",
    ]),
  );
  return triees((detail.structure_slides ?? []) as ContenuSlide[]).map((s) => ({
    position: s.position,
    media_id: s.media_id,
    url: s.media_id ? (detail.mediaUrls?.[s.media_id] ?? null) : null,
    chemin: s.media_id ? (detail.mediaChemins?.[s.media_id] ?? null) : null,
    texte: texteParPos.get(s.position) ?? "",
    calques: [],
    sale: false,
  }));
}

function Vignette({ contenu, actif, onClick }: {
  contenu: ContenuListe;
  actif: boolean;
  onClick: () => void;
}) {
  const premiere = triees((contenu.structure_slides ?? []) as ContenuSlide[])[0];
  const url = premiere?.media_id ? contenu.mediaUrls?.[premiere.media_id] : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md border p-2 text-left transition hover:bg-muted/60",
        actif && "border-primary bg-primary/5",
      )}
    >
      <div className="size-12 shrink-0 overflow-hidden rounded bg-muted">
        {url && <img src={url} alt="" className="size-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{contenu.titre || "—"}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {contenu.tier && (
            <Badge variant="outline" className="text-[10px]">
              {contenu.tier}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {nomLangue(contenu.langue_source)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            · {(contenu.structure_slides ?? []).length} slides
          </span>
        </div>
      </div>
    </button>
  );
}

function Editeur({
  contenuId,
  rang,
  total,
  onQuitter,
  onAller,
  onTraite,
}: {
  contenuId: string;
  /** Position dans la file, 1-indexée. */
  rang: number;
  total: number;
  /** Sortir vers la liste. */
  onQuitter: () => void;
  /** Naviguer sans rien décider. */
  onAller: (delta: -1 | 1) => void;
  /** Validé ou rejeté : passer au suivant. */
  onTraite: () => void;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const editeurs = React.useRef(new Map<number, EditeurSlideHandle | null>());

  const detail = useQuery({
    queryKey: ["file", "detail", contenuId],
    queryFn: () => lireSlideshow(contenuId),
  });
  const formats = useQuery({ queryKey: ["formats"], queryFn: () => listerFormats() });
  const blocs = useQuery({ queryKey: ["blocs-png"], queryFn: listerBlocsPng });

  const [travail, setTravail] = React.useState<SlideTravail[] | null>(null);
  const [titre, setTitre] = React.useState("");
  const [formatId, setFormatId] = React.useState<string>("");
  const [tier, setTier] = React.useState<string>("");
  const [cible, setCible] = React.useState(0);
  const [hashtags, setHashtags] = React.useState("");
  const [musiqueTitre, setMusiqueTitre] = React.useState("");
  const [musiqueUrl, setMusiqueUrl] = React.useState("");
  const [note, setNote] = React.useState("");
  const [labelIds, setLabelIds] = React.useState<string[]>([]);
  /** Slide qui porte le CTA micabo écrit à la main. null = placement auto. */
  const [ctaSlide, setCtaSlide] = React.useState<number | null>(null);
  const [erreur, setErreur] = React.useState<string | null>(null);
  /** Une retouche attend d'être écrite. Garde-fou avant de changer de slideshow. */
  const [modifie, setModifie] = React.useState(false);

  /**
   * Enrobe un setState pour marquer l'éditeur sale au moment même où il écrit.
   * Enchaîner 121 slideshows veut dire cliquer « suivant » vite : un setModifie
   * oublié sur un champ ferait partir une retouche sans un mot.
   */
  function edite<T>(set: React.Dispatch<React.SetStateAction<T>>) {
    return (v: React.SetStateAction<T>) => {
      setModifie(true);
      set(v);
    };
  }

  /** Quitter ce slideshow : confirme si une retouche n'est pas enregistrée. */
  function quitterVers(action: () => void) {
    if (modifie && !window.confirm(t("file.quitterSansEnregistrer"))) return;
    action();
  }

  const d = detail.data;
  React.useEffect(() => {
    if (!d) return;
    setTravail(construireTravail(d));
    setTitre(d.titre ?? "");
    setFormatId(d.format_id ?? "");
    setTier(d.tier ?? "");
    setCible(d.passages_cible ?? 0);
    setMusiqueTitre(d.musique_titre ?? "");
    setMusiqueUrl(d.musique_url ?? "");
    setNote(d.file_note ?? "");
    setLabelIds((d.labels ?? []).map((l) => l.id));
    const deckSource = d.langues.find((l) => l.langue === d.langue_source) ?? d.langues[0];
    setHashtags(deckSource?.hashtags ?? "");
    const porteuse = ((deckSource?.slides ?? []) as Array<{
      position: number;
      position_sophia: boolean;
    }>).find((sl) => sl.position_sophia);
    setCtaSlide(d.placement_manuel ? (porteuse?.position ?? null) : null);
    setModifie(false);
  }, [d]);

  const deckSource = d
    ? (d.langues.find((l) => l.langue === d.langue_source) ?? d.langues[0] ?? null)
    : null;

  /** Écrit tout ce qui a bougé. Renvoie la liste des slides effectivement aplaties. */
  const enregistrer = React.useCallback(async () => {
    if (!d || !travail) return 0;
    let aplaties = 0;

    // 1 — Images retouchées : aplatir le montage par-dessus l'image propre.
    for (const s of travail) {
      if (!s.sale || s.calques.length === 0 || !s.media_id || !s.chemin) continue;
      const blob = await editeurs.current.get(s.position)?.aplatir();
      if (!blob) continue;
      await remplacerImagePropre(
        { id: s.media_id, storage_path: s.chemin },
        blob,
        { contenuId: d.id, position: s.position },
      );
      aplaties += 1;
    }

    // 2 — Structure (ordre / suppressions), en gardant les champs qu'on ne
    // gère pas ici (pinned, critere, tentatives…).
    const parPos = new Map(
      ((d.structure_slides ?? []) as ContenuSlide[]).map((s) => [s.position, s]),
    );
    await ecrireStructureSlides(
      d.id,
      travail.map((s, i) => ({
        ...(parPos.get(s.position) ?? {}),
        position: i + 1,
        media_id: s.media_id,
      })),
    );

    // 3 — Textes du deck source, position par position.
    if (deckSource) {
      const avant = new Map(
        ((deckSource.slides ?? []) as Array<{ position: number; texte_overlay: string | null }>).map(
          (s) => [s.position, s.texte_overlay ?? ""],
        ),
      );
      for (const [i, s] of travail.entries()) {
        if (avant.get(s.position) === s.texte) continue;
        await majTexteSlideDeck(deckSource.id, i + 1, s.texte);
      }
      if ((deckSource.hashtags ?? "") !== hashtags) {
        await majHashtagsDeck(deckSource.id, hashtags);
      }
    }

    // 4 — Champs plats + format + labels + note.
    await majChampsContenu(d.id, {
      titre,
      musique_titre: musiqueTitre.trim() || null,
      musique_url: musiqueUrl.trim() || null,
      tier: tier || null,
      passages_cible: Math.max(0, Math.round(cible)),
    });
    if ((d.format_id ?? "") !== formatId) {
      await definirFormatContenu(d.id, formatId || null);
    }
    await setLabelsContenu(d.id, labelIds);
    if ((d.file_note ?? "") !== note) await ecrireNoteFile(d.id, note);

    // 5 — Placement micabo. Après l'écriture des textes et la renumérotation :
    // la position cochée est celle du deck FINAL.
    const ctaFinal =
      ctaSlide == null
        ? null
        : (travail.findIndex((sl) => sl.position === ctaSlide) + 1 || null);
    const avantManuel = Boolean(d.placement_manuel);
    const avantSlide = ((deckSource?.slides ?? []) as Array<{
      position: number;
      position_sophia: boolean;
    }>).find((sl) => sl.position_sophia)?.position ?? null;
    if (avantManuel !== (ctaFinal != null) || (ctaFinal != null && avantSlide !== ctaFinal)) {
      await definirPlacementManuel(d.id, d.langue_source, ctaFinal);
    }

    return aplaties;
  }, [d, travail, deckSource, titre, musiqueTitre, musiqueUrl, tier, cible, formatId, labelIds, note, hashtags, ctaSlide]);

  const sauver = useMutation({
    mutationFn: enregistrer,
    onSuccess: () => {
      setErreur(null);
      void qc.invalidateQueries({ queryKey: ["file"] });
    },
    onError: (e) => setErreur((e as Error).message),
  });

  const valider = useMutation({
    mutationFn: async () => {
      await enregistrer();
      await validerSlideshow(contenuId);
    },
    onSuccess: () => {
      setModifie(false);
      void qc.invalidateQueries({ queryKey: ["file"] });
      onTraite();
    },
    onError: (e) => setErreur((e as Error).message),
  });

  const rejeter = useMutation({
    mutationFn: () => supprimerContenu(contenuId),
    onSuccess: () => {
      setModifie(false);
      void qc.invalidateQueries({ queryKey: ["file"] });
      onTraite();
    },
    onError: (e) => setErreur((e as Error).message),
  });

  const occupe = sauver.isPending || valider.isPending || rejeter.isPending;

  if (detail.isPending) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!d || !travail) return <EmptyState title={t("file.introuvable")} />;

  const majSlide = (position: number, patch: Partial<SlideTravail>) =>
    edite(setTravail)((prev) =>
      (prev ?? []).map((s) => (s.position === position ? { ...s, ...patch } : s)),
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{d.titre || "—"}</h2>
          <p className="text-xs text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground">
              {t("file.rang", { rang, total })}
            </span>
            {" · "}
            {nomLangue(d.langue_source)}
            {d.source?.handle_tiktok ? ` · @${d.source.handle_tiktok}` : ""}
            {d.vues_source != null
              ? ` · ${t("slideshows.vuesSource")} ${d.vues_source.toLocaleString(i18n.language)}`
              : ""}
            {d.tier_note_import != null ? ` · ${Math.round(d.tier_note_import)}/100` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => quitterVers(onQuitter)}
            disabled={occupe}
          >
            {t("file.retour")}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            aria-label={t("file.precedent")}
            disabled={occupe || rang <= 1}
            onClick={() => quitterVers(() => onAller(-1))}
          >
            <ArrowLeft className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-8"
            aria-label={t("file.suivant")}
            disabled={occupe || rang >= total}
            onClick={() => quitterVers(() => onAller(1))}
          >
            <ArrowRight className="size-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => sauver.mutate()} disabled={occupe}>
            {sauver.isPending ? t("common.saving") : t("file.enregistrer")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={occupe}
            onClick={() => {
              if (window.confirm(t("file.confirmRejet"))) rejeter.mutate();
            }}
          >
            <Trash2 className="size-3.5" />
            {t("file.rejeter")}
          </Button>
          <Button size="sm" onClick={() => valider.mutate()} disabled={occupe}>
            <Check className="size-3.5" />
            {valider.isPending ? t("common.saving") : t("file.valider")}
          </Button>
        </div>
      </div>

      {erreur && <p className="text-sm text-destructive">{erreur}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("file.metaTitre")}</CardTitle>
          <CardDescription>{t("file.metaDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="file-titre">{t("file.titre")}</Label>
            <Input id="file-titre" value={titre} onChange={(e) => edite(setTitre)(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="file-format">{t("file.format")}</Label>
            <select
              id="file-format"
              className={selectClass}
              value={formatId}
              onChange={(e) => edite(setFormatId)(e.target.value)}
            >
              <option value="">{t("file.formatAucun")}</option>
              {(formats.data ?? [])
                .filter((f) => f.actif || f.id === formatId)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nom}
                  </option>
                ))}
            </select>
            <p className="text-xs text-muted-foreground">{t("file.formatAide")}</p>
          </div>
          <div className="space-y-1">
            <Label>{t("file.labels")}</Label>
            <LabelPicker selected={labelIds} onChange={edite(setLabelIds)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="file-tier">{t("file.tier")}</Label>
            <select
              id="file-tier"
              className={selectClass}
              value={tier}
              onChange={(e) => edite(setTier)(e.target.value)}
            >
              <option value="">—</option>
              {TIERS.map((x: Tier) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="file-cible">{t("file.passagesCible")}</Label>
            <Input
              id="file-cible"
              type="number"
              min={0}
              value={cible}
              onChange={(e) => edite(setCible)(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="file-mus-titre">{t("file.musiqueTitre")}</Label>
            <Input
              id="file-mus-titre"
              value={musiqueTitre}
              onChange={(e) => edite(setMusiqueTitre)(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="file-mus-url">{t("file.musiqueUrl")}</Label>
            <Input
              id="file-mus-url"
              value={musiqueUrl}
              onChange={(e) => edite(setMusiqueUrl)(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="file-hashtags">{t("file.hashtags")}</Label>
            <Input
              id="file-hashtags"
              value={hashtags}
              onChange={(e) => edite(setHashtags)(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="file-note">{t("file.note")}</Label>
            <Textarea
              id="file-note"
              rows={2}
              value={note}
              onChange={(e) => edite(setNote)(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("file.bilanTitre")}</CardTitle>
          <CardDescription>{t("file.bilanDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PassagesSlideshow
            contenuId={d.id}
            passages={d.passages ?? []}
            chargement={detail.isFetching}
          />
        </CardContent>
      </Card>

      <p
        className={cn(
          "rounded-md border px-3 py-2 text-xs",
          ctaSlide != null
            ? "border-primary/40 bg-primary/5"
            : "text-muted-foreground",
        )}
      >
        {ctaSlide != null ? t("file.ctaManuel") : t("file.ctaAuto")}
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {travail.map((s, index) => (
          <Card key={s.position}>
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium">#{index + 1}</span>
                <div className="flex gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={t("file.monter")}
                    disabled={index === 0}
                    onClick={() => edite(setTravail)((p) => deplacerSlide(p ?? [], s.position, -1))}
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={t("file.descendre")}
                    disabled={index === travail.length - 1}
                    onClick={() => edite(setTravail)((p) => deplacerSlide(p ?? [], s.position, 1))}
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:text-destructive"
                    aria-label={t("file.supprimerSlide")}
                    disabled={travail.length <= 1}
                    onClick={() => edite(setTravail)((p) => retirerSlide(p ?? [], s.position))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {s.url ? (
                <EditeurSlide
                  ref={(h) => editeurs.current.set(s.position, h)}
                  imageUrl={s.url}
                  calques={s.calques}
                  blocs={blocs.data ?? []}
                  disabled={occupe}
                  onCalques={(calques) => majSlide(s.position, { calques, sale: true })}
                />
              ) : (
                <div className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">
                  {t("file.sansImage")}
                </div>
              )}

              <Textarea
                rows={3}
                value={s.texte}
                disabled={occupe}
                onChange={(e) => majSlide(s.position, { texte: e.target.value })}
              />

              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={occupe}
                  checked={ctaSlide === s.position}
                  onChange={(e) => edite(setCtaSlide)(e.target.checked ? s.position : null)}
                />
                <span className="text-muted-foreground">{t("file.ctaIci")}</span>
              </label>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AdminFilePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { applicationId } = useApplication();
  const [ouvert, setOuvert] = React.useState<string | null>(null);
  /**
   * L'ordre de la file, figé à l'ouverture du premier slideshow.
   *
   * Valider retire le slideshow de la liste, qui se recharge : se repérer dans
   * la liste vivante ferait sauter la place à chaque validation. L'ordre figé
   * garde « le suivant » là où il était quand on est entré.
   */
  const [ordre, setOrdre] = React.useState<string[]>([]);

  const file = useQuery({
    queryKey: ["file", "liste", applicationId],
    queryFn: () =>
      listerContenus({ statut: "brouillon", limit: 300, applicationId }).then((liste) =>
        liste.filter((c) => c.import_statut === "done"),
      ),
  });

  const purger = useMutation({
    mutationFn: async () => {
      const liste = file.data ?? [];
      for (const c of liste) await supprimerContenu(c.id);
      return liste.length;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["file"] }),
  });

  if (ouvert) {
    const i = ordre.indexOf(ouvert);
    const aller = (delta: -1 | 1) => {
      const cible = ordre[i + delta];
      if (cible) setOuvert(cible);
    };
    return (
      <Editeur
        // Remontage à chaque slideshow : les calques posés, les refs de canvas
        // et le drapeau « modifié » ne doivent rien garder du précédent.
        key={ouvert}
        contenuId={ouvert}
        rang={i + 1}
        total={ordre.length}
        onQuitter={() => setOuvert(null)}
        onAller={aller}
        onTraite={() => setOuvert(ordre[i + 1] ?? null)}
      />
    );
  }

  const liste = file.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("file.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("file.subtitle")}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={liste.length === 0 || purger.isPending}
          onClick={() => {
            if (window.confirm(t("file.confirmPurge", { n: liste.length }))) purger.mutate();
          }}
        >
          <Trash2 className="size-3.5" />
          {purger.isPending ? t("common.saving") : t("file.purger", { n: liste.length })}
        </Button>
      </div>

      {file.isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {file.isError && (
        <p className="text-sm text-destructive">{(file.error as Error).message}</p>
      )}

      {!file.isPending && liste.length === 0 && <EmptyState title={t("file.vide")} />}

      {liste.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("file.enAttente", { n: liste.length })}</CardTitle>
            <CardDescription>{t("file.enAttenteDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {liste.map((c) => (
              <Vignette
                key={c.id}
                contenu={c}
                actif={false}
                onClick={() => {
                  setOrdre(liste.map((x) => x.id));
                  setOuvert(c.id);
                }}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
