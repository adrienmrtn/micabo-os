import * as React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarOff, MessageSquareWarning, UserX } from "lucide-react";

import { QualificationBadge } from "@/components/moteur/QualificationBadge";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  envoyerNudge,
  fileSurveillance,
  marquerHmPrevenu,
  marquerNePasRenouveler,
  modelesNudge,
  poserQualification,
  rendreQualificationAuMoteur,
  skipperSurveillance,
  type CompteSurveille,
  type ModeleNudge,
} from "@/features/moteur/api";
import { QUALIFICATIONS, type Qualification } from "@/features/moteur/qualification";
import { nomLangue } from "@/features/moteur/langues";

const CLE = ["surveillance"] as const;

function abrege(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Identité du créateur + ce qui explique sa case. Partagé par les deux listes. */
function Identite({ c }: { c: CompteSurveille }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/admin/createurs/${c.compte_id}`}
          className="truncate font-medium hover:underline"
        >
          {c.nom}
        </Link>
        {c.handle_tiktok && (
          <span className="text-xs text-muted-foreground">
            @{c.handle_tiktok.replace(/^@/, "")}
          </span>
        )}
        <Badge variant="outline" size="sm">
          {nomLangue(c.langue)}
        </Badge>
        <QualificationBadge
          qualification={c.qualification}
          manuelle={c.qualification_manuelle}
          size="sm"
        />
        {c.trial && (
          <Badge variant="info" size="sm" title={t("surveillance.trialAide")}>
            {t("surveillance.trial")}
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("surveillance.prevus", { publies: c.publies, prevus: c.prevus })}
        {" · "}
        {c.moyenneVues == null
          ? t("surveillance.moyenneAucune")
          : t("surveillance.moyenne", { n: abrege(c.moyenneVues) })}
      </p>

      <p className="text-xs text-muted-foreground">
        {c.trial && c.trialHeures != null
          ? `${t("surveillance.trialFin", { h: c.trialHeures })} · `
          : null}
        {c.qualification_maj_at
          ? t("surveillance.requalifie", {
              date: new Date(c.qualification_maj_at).toLocaleDateString(i18n.language),
            })
          : t("surveillance.jamaisRequalifie")}
        {c.dernierNudge
          ? ` · ${t("surveillance.nudgeDernier", {
              date: new Date(c.dernierNudge.envoye_at).toLocaleDateString(i18n.language),
            })}${c.dernierNudge.lu_at ? "" : ` (${t("surveillance.nudgeNonLu")})`}`
          : null}
      </p>
    </div>
  );
}

function LigneFile({
  c,
  onNudge,
}: {
  c: CompteSurveille;
  onNudge: (c: CompteSurveille) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const rafraichir = () => queryClient.invalidateQueries({ queryKey: CLE });

  const skip = useMutation({
    mutationFn: () => skipperSurveillance(c.compte_id),
    onSuccess: rafraichir,
  });
  const poser = useMutation({
    mutationFn: (q: Qualification) => poserQualification(c.compte_id, q),
    onSuccess: rafraichir,
  });
  const rendre = useMutation({
    mutationFn: () => rendreQualificationAuMoteur(c.compte_id),
    onSuccess: rafraichir,
  });
  const nePasRenouveler = useMutation({
    mutationFn: () => marquerNePasRenouveler(c.compte_id, true),
    onSuccess: rafraichir,
  });

  const enCours =
    skip.isPending || poser.isPending || rendre.isPending || nePasRenouveler.isPending;

  return (
    <li className="space-y-2.5 rounded-lg border p-3">
      <Identite c={c} />

      {c.surveillance_skip_jusqu_a &&
        new Date(c.surveillance_skip_jusqu_a).getTime() > Date.now() && (
          <p className="text-xs text-muted-foreground">
            {t("surveillance.skipJusqua", {
              date: new Date(c.surveillance_skip_jusqu_a).toLocaleDateString(i18n.language),
            })}
          </p>
        )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={enCours}
          title={t("surveillance.skipAide")}
          onClick={() => skip.mutate()}
        >
          <CalendarOff className="mr-1.5 size-3.5" />
          {t("surveillance.skip")}
        </Button>

        <Select
          value={c.qualification}
          onValueChange={(v) => {
            if (typeof v === "string" && v !== c.qualification) poser.mutate(v as Qualification);
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-44"
            aria-label={t("surveillance.changerCase")}
            title={t("surveillance.changerCaseAide")}
            disabled={enCours}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectPopup alignItemWithTrigger={false}>
            {QUALIFICATIONS.map((q) => (
              <SelectItem key={q} value={q}>
                {t(`qualification.${q}`)}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>

        {c.qualification_manuelle && (
          <Button
            size="sm"
            variant="ghost"
            disabled={enCours}
            title={t("surveillance.deverrouillerAide")}
            onClick={() => rendre.mutate()}
          >
            {t("surveillance.deverrouiller")}
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          disabled={enCours}
          title={t("surveillance.nudgeAide")}
          onClick={() => onNudge(c)}
        >
          <MessageSquareWarning className="mr-1.5 size-3.5" />
          {t("surveillance.nudge")}
        </Button>

        {!c.ne_pas_renouveler && (
          <Button
            size="sm"
            variant="outline"
            disabled={enCours}
            title={t("surveillance.nePasRenouvelerAide")}
            onClick={() => nePasRenouveler.mutate()}
          >
            <UserX className="mr-1.5 size-3.5" />
            {t("surveillance.nePasRenouveler")}
          </Button>
        )}
      </div>
    </li>
  );
}

function LigneNonRenouvele({ c }: { c: CompteSurveille }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const rafraichir = () => queryClient.invalidateQueries({ queryKey: CLE });

  const hm = useMutation({
    mutationFn: (valeur: boolean) => marquerHmPrevenu(c.compte_id, valeur),
    onSuccess: rafraichir,
  });
  const retirer = useMutation({
    mutationFn: () => marquerNePasRenouveler(c.compte_id, false),
    onSuccess: rafraichir,
  });

  return (
    <li className="space-y-2.5 rounded-lg border p-3">
      <Identite c={c} />

      <p className="text-xs text-muted-foreground">
        {c.ne_pas_renouveler_at
          ? t("surveillance.ajouteLe", {
              date: new Date(c.ne_pas_renouveler_at).toLocaleDateString(i18n.language),
            })
          : null}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={c.hm_prevenu}
            disabled={hm.isPending}
            onCheckedChange={(v) => hm.mutate(v === true)}
          />
          <span>{t("surveillance.hmPrevenu")}</span>
          {c.hm_prevenu && c.hm_prevenu_at ? (
            <span className="text-xs text-muted-foreground">
              {t("surveillance.hmPrevenuLe", {
                date: new Date(c.hm_prevenu_at).toLocaleDateString(i18n.language),
              })}
            </span>
          ) : (
            <Badge variant="warning" size="sm">
              {t("surveillance.hmEnAttente")}
            </Badge>
          )}
        </label>

        <Button
          size="sm"
          variant="ghost"
          disabled={retirer.isPending}
          onClick={() => retirer.mutate()}
        >
          {t("surveillance.retirerListe")}
        </Button>
      </div>
    </li>
  );
}

function DialogNudge({
  compte,
  onClose,
}: {
  compte: CompteSurveille | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [cle, setCle] = React.useState<string | null>(null);

  const modeles = useQuery({
    queryKey: ["nudges-modeles"],
    queryFn: modelesNudge,
    enabled: Boolean(compte),
  });

  React.useEffect(() => {
    // À chaque ouverture, repartir du premier message : garder le choix
    // précédent ferait envoyer le mauvais message au créateur suivant.
    setCle(modeles.data?.[0]?.cle ?? null);
  }, [compte, modeles.data]);

  const choisi: ModeleNudge | null =
    modeles.data?.find((m) => m.cle === cle) ?? modeles.data?.[0] ?? null;

  const envoyer = useMutation({
    mutationFn: () => {
      if (!compte || !choisi) throw new Error("Aucun message choisi");
      return envoyerNudge({
        compteId: compte.compte_id,
        posterId: compte.poster_id,
        langueCompte: compte.langue,
        modele: choisi,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLE });
      onClose();
    },
  });

  return (
    <Dialog open={Boolean(compte)} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("surveillance.nudgeTitre", { nom: compte?.nom ?? "" })}</DialogTitle>
          <DialogDescription>{t("surveillance.nudgeAide")}</DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          {modeles.isPending && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {!modeles.isPending && (modeles.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("surveillance.nudgeAucunModele")}
            </p>
          )}
          {(modeles.data ?? []).length > 0 && (
            <>
              <Select
                value={choisi?.cle ?? ""}
                onValueChange={(v) => typeof v === "string" && setCle(v)}
              >
                <SelectTrigger aria-label={t("surveillance.nudgeChoisir")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup alignItemWithTrigger={false}>
                  {(modeles.data ?? []).map((m) => (
                    <SelectItem key={m.cle} value={m.cle}>
                      {m.titre}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              {/* Le corps exact est montré avant l'envoi : on ne fait pas partir
                  à l'aveugle un message écrit il y a six mois. */}
              {choisi && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">{choisi.titre}</p>
                  <p className="mt-1 text-muted-foreground">{choisi.corps}</p>
                </div>
              )}
            </>
          )}
          {envoyer.isError && (
            <p className="text-sm text-destructive">{(envoyer.error as Error).message}</p>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={envoyer.isPending}
            disabled={!choisi || envoyer.isPending}
            onClick={() => envoyer.mutate()}
          >
            {t("surveillance.nudgeEnvoyer")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export function AdminSurveillancePage() {
  const { t } = useTranslation();
  const [nudge, setNudge] = React.useState<CompteSurveille | null>(null);

  const donnees = useQuery({
    queryKey: CLE,
    queryFn: fileSurveillance,
    refetchInterval: 120_000,
  });

  const file = donnees.data?.file ?? [];
  const liste = donnees.data?.nePasRenouveler ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("surveillance.title")}</CardTitle>
          <CardDescription>{t("surveillance.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {donnees.isPending && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {donnees.isError && (
            <p className="text-sm text-destructive">{(donnees.error as Error).message}</p>
          )}
          {!donnees.isPending && file.length === 0 && (
            <EmptyState
              title={t("surveillance.fileVide")}
              description={t("surveillance.fileVideAide")}
            />
          )}
          {file.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {t("surveillance.compte", { count: file.length })}
              </p>
              <ul className="space-y-2">
                {file.map((c) => (
                  <LigneFile key={c.compte_id} c={c} onNudge={setNudge} />
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("surveillance.listeTitre")}</CardTitle>
          <CardDescription>{t("surveillance.listeDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {liste.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("surveillance.listeVide")}</p>
          ) : (
            <ul className="space-y-2">
              {liste.map((c) => (
                <LigneNonRenouvele key={c.compte_id} c={c} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DialogNudge compte={nudge} onClose={() => setNudge(null)} />
    </div>
  );
}
