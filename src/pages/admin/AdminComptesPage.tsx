import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { executerEnLot } from "@/lib/lot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import {
  creerCompte,
  genererPersona,
  listerComptes,
  listerMedias,
  listerPosters,
  listerSources,
  majCompte,
  supprimerCompte,
} from "@/features/moteur/api";
import type { CompteAvecDetails } from "@/features/moteur/types";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Sélecteur d'avatar. Les visuels portant un visage identifiable sont exclus :
 * le compte est public et la personne photographiée n'a rien demandé.
 */
function ChoixAvatar({ compte }: { compte: CompteAvecDetails }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [ouvert, setOuvert] = React.useState(false);

  const medias = useQuery({
    queryKey: ["medias", compte.compte_reference_id],
    queryFn: () => listerMedias(compte.compte_reference_id ?? undefined),
    enabled: ouvert,
  });

  const choisir = useMutation({
    mutationFn: (url: string) =>
      majCompte(compte.id, { avatar_url: url, avatar_source: "bibliotheque" }),
    onSuccess: () => {
      setOuvert(false);
      queryClient.invalidateQueries({ queryKey: ["comptes"] });
    },
  });

  const utilisables = (medias.data ?? []).filter((m) => m.visage_identifiable === false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {compte.avatar_url ? (
          <img
            src={compte.avatar_url}
            alt=""
            className="size-10 rounded-full border object-cover"
          />
        ) : (
          <div className="size-10 rounded-full border bg-muted" />
        )}
        <Button size="sm" variant="outline" onClick={() => setOuvert((o) => !o)}>
          {t("comptes.choisirAvatar")}
        </Button>
      </div>

      {ouvert && (
        <div className="rounded-lg border p-3">
          {medias.isPending && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {medias.data && utilisables.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("comptes.avatarAucun")}</p>
          )}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {utilisables.map((media) => (
              <button
                key={media.id}
                type="button"
                onClick={() => choisir.mutate(media.url)}
                className="overflow-hidden rounded-md border transition-opacity hover:opacity-80"
              >
                <img src={media.url} alt="" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Génère une identité (pseudos, bio, avatar) à partir de la seule niche. Les
 * pseudos évoquant le compte de référence sont écartés côté serveur, et
 * l'avatar ne peut venir que d'un visuel sans visage identifiable.
 */
function GenerationPersona({ compte }: { compte: CompteAvecDetails }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const proposition = useMutation({
    mutationFn: () => genererPersona(compte.id),
  });
  const appliquer = useMutation({
    mutationFn: () => genererPersona(compte.id, true),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comptes"] }),
  });

  const enCours = proposition.isPending || appliquer.isPending;
  const resultat = proposition.data;

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={enCours} onClick={() => proposition.mutate()}>
          {proposition.isPending ? t("comptes.generation") : t("comptes.genererPersona")}
        </Button>
        {resultat && resultat.pseudos.length > 0 && (
          <Button size="sm" disabled={enCours} onClick={() => appliquer.mutate()}>
            {appliquer.isPending ? t("common.saving") : t("comptes.appliquer")}
          </Button>
        )}
      </div>

      {resultat && resultat.pseudos.length === 0 && (
        <p className="text-sm text-warning">{t("comptes.personaVide")}</p>
      )}

      {resultat && resultat.pseudos.length > 0 && (
        <div className="space-y-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t("comptes.pseudosProposes")}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {resultat.pseudos.map((pseudo) => (
                <Badge key={pseudo} variant="secondary">
                  @{pseudo}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("comptes.bioProposee")}</p>
            <p className="whitespace-pre-wrap pt-1">{resultat.bio}</p>
          </div>
          {resultat.avatarUrl && (
            <img
              src={resultat.avatarUrl}
              alt=""
              className="size-16 rounded-full border object-cover"
            />
          )}
        </div>
      )}

      {(proposition.isError || appliquer.isError) && (
        <p className="text-sm text-destructive">
          {((proposition.error ?? appliquer.error) as Error).message}
        </p>
      )}
    </div>
  );
}

/**
 * Réglages propres à un compte. Tant qu'ils sont vides, le compte suit les
 * réglages globaux ; les renseigner permet par exemple de dédier un compte au
 * seul recopiage sans toucher aux autres.
 */
function ReglagesCompte({ compte }: { compte: CompteAvecDetails }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const surcharge = compte.repartition !== null || compte.posts_par_jour !== null;

  const [repartition, setRepartition] = React.useState(
    compte.repartition ?? { recycle: 60, remanie: 20, nouveau: 20 },
  );
  const [parJour, setParJour] = React.useState(compte.posts_par_jour ?? 2);

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["comptes"] });
  const enregistrer = useMutation({
    mutationFn: () =>
      majCompte(compte.id, { repartition, posts_par_jour: parJour }),
    onSuccess: rafraichir,
  });
  const reinitialiser = useMutation({
    mutationFn: () => majCompte(compte.id, { repartition: null, posts_par_jour: null }),
    onSuccess: rafraichir,
  });

  const total = repartition.recycle + repartition.remanie + repartition.nouveau;
  const totalValide = total === 100;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{t("comptes.reglagesPropres")}</p>
        <Badge variant={surcharge ? "default" : "outline"}>
          {surcharge ? t("comptes.surcharge") : t("comptes.suitGlobal")}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(["recycle", "remanie", "nouveau"] as const).map((cle) => (
          <div key={cle} className="space-y-1">
            <Label htmlFor={`${cle}-${compte.id}`} className="text-xs">
              {t(`reglages.${cle}`)}
            </Label>
            <Input
              id={`${cle}-${compte.id}`}
              type="number"
              min={0}
              value={repartition[cle]}
              onChange={(e) =>
                setRepartition({ ...repartition, [cle]: Number(e.target.value) })
              }
            />
          </div>
        ))}
        <div className="space-y-1">
          <Label htmlFor={`jour-${compte.id}`} className="text-xs">
            {t("reglages.postsParJour")}
          </Label>
          <Input
            id={`jour-${compte.id}`}
            type="number"
            min={1}
            value={parJour}
            onChange={(e) => setParJour(Number(e.target.value))}
          />
        </div>
      </div>

      {!totalValide && (
        <p className="text-xs text-destructive">{t("reglages.totalInvalide")}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!totalValide || enregistrer.isPending}
          onClick={() => enregistrer.mutate()}
        >
          {enregistrer.isPending ? t("common.saving") : t("comptes.activerSurcharge")}
        </Button>
        {surcharge && (
          <Button size="sm" variant="outline" onClick={() => reinitialiser.mutate()}>
            {t("comptes.retirerSurcharge")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("comptes.reglagesHint")}</p>
    </div>
  );
}

function LigneCompte({ compte }: { compte: CompteAvecDetails }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [voix, setVoix] = React.useState(compte.style_profile ?? "");

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["comptes"] });
  const enregistrer = useMutation({
    mutationFn: () => majCompte(compte.id, { style_profile: voix || null }),
    onSuccess: rafraichir,
  });
  const retirer = useMutation({
    mutationFn: () => supprimerCompte(compte.id),
    onSuccess: rafraichir,
  });

  const modifie = voix !== (compte.style_profile ?? "");

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {compte.persona_nom ?? compte.handle_tiktok ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {[
              compte.profiles
                ? [compte.profiles.prenom, compte.profiles.nom].filter(Boolean).join(" ")
                : null,
              compte.handle_tiktok ? `@${compte.handle_tiktok}` : null,
              compte.langue.toUpperCase(),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {compte.comptes_reference && (
            // Visible ici seulement : l'admin doit savoir d'où vient la matière,
            // le poster ne le voit jamais.
            <Badge variant="outline">@{compte.comptes_reference.handle_tiktok}</Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (window.confirm(t("comptes.confirmDelete"))) retirer.mutate();
            }}
          >
            {t("common.delete")}
          </Button>
        </div>
      </div>

      <ChoixAvatar compte={compte} />

      <GenerationPersona compte={compte} />

      <ReglagesCompte compte={compte} />

      <div className="space-y-2">
        <Label htmlFor={`voix-${compte.id}`}>{t("comptes.styleProfile")}</Label>
        <Textarea
          id={`voix-${compte.id}`}
          rows={3}
          className="text-xs"
          value={voix}
          onChange={(e) => setVoix(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t("comptes.styleProfileHint")}</p>
        {modifie && (
          <Button size="sm" disabled={enregistrer.isPending} onClick={() => enregistrer.mutate()}>
            {enregistrer.isPending ? t("common.saving") : t("common.save")}
          </Button>
        )}
      </div>
    </div>
  );
}

export function AdminComptesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const comptes = useQuery({ queryKey: ["comptes"], queryFn: listerComptes });
  const posters = useQuery({ queryKey: ["posters"], queryFn: listerPosters });
  const sources = useQuery({ queryKey: ["sources"], queryFn: listerSources });

  const [posterId, setPosterId] = React.useState("");
  const [sourceId, setSourceId] = React.useState("");
  const [persona, setPersona] = React.useState("");
  const [handle, setHandle] = React.useState("");

  const ajouter = useMutation({
    mutationFn: () =>
      creerCompte({
        posterId,
        compteReferenceId: sourceId || null,
        langue: "fr",
        personaNom: persona,
        handleTiktok: handle,
      }),
    onSuccess: () => {
      setPersona("");
      setHandle("");
      queryClient.invalidateQueries({ queryKey: ["comptes"] });
    },
  });

  const posterEligibles = (posters.data ?? []).filter((p) => p.role === "poster");

  // Identités incomplètes : sans pseudo ou sans avatar généré.
  const [lotPersona, setLotPersona] = React.useState<{ fait: number; total: number } | null>(null);
  const incompletes = (comptes.data ?? []).filter((c) => !c.persona_nom || !c.avatar_url);

  async function completerIdentites() {
    setLotPersona({ fait: 0, total: incompletes.length });
    await executerEnLot(
      incompletes,
      (c) => genererPersona(c.id, true),
      { largeur: 2, onProgres: (fait, total) => setLotPersona({ fait, total }) },
    );
    setLotPersona(null);
    queryClient.invalidateQueries({ queryKey: ["comptes"] });
  }

  return (
    <div className="space-y-6">
      {incompletes.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div>
              <p className="text-sm font-medium">{t("comptes.identitesTitre")}</p>
              <p className="text-xs text-muted-foreground">
                {t("comptes.identitesDesc", { count: incompletes.length })}
              </p>
            </div>
            <Button disabled={lotPersona !== null} onClick={completerIdentites}>
              <Sparkles className="size-4" />
              {lotPersona
                ? t("comptes.identitesEnCours", { fait: lotPersona.fait, total: lotPersona.total })
                : t("comptes.completerIdentites", { count: incompletes.length })}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("comptes.title")}</CardTitle>
          <CardDescription>{t("comptes.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (posterId) ajouter.mutate();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="poster">{t("comptes.poster")}</Label>
              <select
                id="poster"
                className={selectClass}
                required
                value={posterId}
                onChange={(e) => setPosterId(e.target.value)}
              >
                <option value="">{t("common.none")}</option>
                {posterEligibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.prenom, p.nom].filter(Boolean).join(" ") || p.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">{t("comptes.source")}</Label>
              <select
                id="source"
                className={selectClass}
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              >
                <option value="">{t("common.none")}</option>
                {sources.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    @{s.handle_tiktok}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona">{t("comptes.persona")}</Label>
              <Input
                id="persona"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="handle">{t("comptes.handle")}</Label>
              <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <Button type="submit" disabled={ajouter.isPending}>
                {ajouter.isPending ? t("common.saving") : t("comptes.add")}
              </Button>
              {ajouter.isError && (
                <p className="mt-2 text-sm text-destructive">
                  {(ajouter.error as Error).message}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {comptes.isPending && (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        )}
        {comptes.data?.length === 0 && <EmptyState title={t("comptes.empty")} />}
        {comptes.data?.map((compte) => <LigneCompte key={compte.id} compte={compte} />)}
      </div>
    </div>
  );
}
