import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Clapperboard, Download, ExternalLink, Loader2, Play, Scissors, Upload, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ajouterDemo,
  archiverModele,
  basculerDemo,
  couperModele,
  deciderRendu,
  enregistrerTextes,
  importerModele,
  lancerRendu,
  listerDemos,
  listerModeles,
  listerPersonasAtelier,
  listerRendus,
  suivreRendus,
  urlMedia,
  type PersonaAtelier,
  type UgcModele,
  type UgcRendu,
} from "@/features/ugc/atelier";
import {
  coutRendu,
  dureeReactionValide,
  MOTEUR_DEFAUT,
  MOTEURS_KLING,
  REACTION_MAX_S,
  REACTION_MIN_S,
  type MoteurKling,
  type SegmentTexte,
} from "@/features/ugc/ugcVideo";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const LANGUES = ["fr", "de", "tr", "es", "en"] as const;

/** Kling rend en plusieurs minutes : on relève tant qu'un rendu attend. */
const SUIVI_MS = 20_000;

function badgeStatut(statut: UgcRendu["statut"]) {
  const variante =
    statut === "valide" ? "success" : statut === "echec" || statut === "rejete" ? "error" : statut === "a_valider" ? "warning" : "info";
  return variante as "success" | "error" | "warning" | "info";
}

export function AdminUgcAtelierPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [lien, setLien] = React.useState("");

  const modeles = useQuery({ queryKey: ["ugc-atelier", "modeles"], queryFn: listerModeles, refetchInterval: 10_000 });
  const rendus = useQuery({ queryKey: ["ugc-atelier", "rendus"], queryFn: listerRendus, refetchInterval: 10_000 });
  const personas = useQuery({ queryKey: ["ugc-atelier", "personas"], queryFn: listerPersonasAtelier });

  const renduAttend = (rendus.data ?? []).some((r) => r.statut === "en_cours");
  React.useEffect(() => {
    if (!renduAttend) return;
    const tic = window.setInterval(() => {
      suivreRendus()
        .then(() => qc.invalidateQueries({ queryKey: ["ugc-atelier", "rendus"] }))
        .catch(() => null);
    }, SUIVI_MS);
    return () => window.clearInterval(tic);
  }, [renduAttend, qc]);

  const importer = useMutation({
    mutationFn: () => importerModele(lien),
    onSuccess: () => {
      setLien("");
      void qc.invalidateQueries({ queryKey: ["ugc-atelier", "modeles"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Clapperboard className="size-5" />
          {t("ugcAtelier.titre")}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("ugcAtelier.intro")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("ugcAtelier.importTitre")}</CardTitle>
          <CardDescription>{t("ugcAtelier.importDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (lien.trim()) importer.mutate();
            }}
          >
            <Input
              placeholder="https://www.tiktok.com/@…/video/…"
              value={lien}
              onChange={(e) => setLien(e.target.value)}
              aria-label={t("ugcAtelier.lien")}
            />
            <Button type="submit" disabled={importer.isPending || !lien.trim()}>
              {importer.isPending ? <Loader2 className="animate-spin" /> : <Download />}
              {t("ugcAtelier.importer")}
            </Button>
          </form>
          {importer.error ? <p className="mt-2 text-sm text-destructive">{importer.error.message}</p> : null}
        </CardContent>
      </Card>

      {modeles.isPending ? <Loader2 className="animate-spin" /> : null}
      {modeles.error ? <p className="text-sm text-destructive">{modeles.error.message}</p> : null}
      {(modeles.data ?? []).map((m) => (
        <CarteModele
          key={m.id}
          modele={m}
          personas={personas.data ?? []}
          rendus={(rendus.data ?? []).filter((r) => r.modele_id === m.id)}
        />
      ))}

      <CarteDemos />
    </div>
  );
}

function CarteModele({
  modele,
  personas,
  rendus,
}: {
  modele: UgcModele;
  personas: PersonaAtelier[];
  rendus: UgcRendu[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const enImport = modele.statut === "a_couper" && !modele.source_path && !modele.erreur;
  // Même seuil que la fonction (IMPORT_ABANDON_MS) : au-delà, recoller le lien relance l'import.
  const importPerdu = enImport && Date.now() - new Date(modele.updated_at).getTime() > 10 * 60 * 1000;
  const rafraichir = () => qc.invalidateQueries({ queryKey: ["ugc-atelier"] });

  const archiver = useMutation({ mutationFn: () => archiverModele(modele.id), onSuccess: rafraichir });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="line-clamp-1">{modele.titre || modele.source_url}</span>
          <Badge variant={modele.statut === "pret" ? "success" : "info"}>
            {t(`ugcAtelier.statutModele.${modele.statut}`)}
          </Badge>
          {modele.vues_source != null ? (
            <span className="text-xs font-normal text-muted-foreground">
              {t("ugcAtelier.vues", { n: modele.vues_source.toLocaleString("fr-FR") })}
            </span>
          ) : null}
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-3">
          <a className="inline-flex items-center gap-1 underline" href={modele.source_url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3" />
            TikTok
          </a>
          {modele.musique_titre ? <span>♪ {modele.musique_titre}</span> : null}
          <button className="text-xs underline" type="button" onClick={() => archiver.mutate()}>
            {t("ugcAtelier.archiver")}
          </button>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {enImport && !importPerdu ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("ugcAtelier.importEnCours")}
          </p>
        ) : null}
        {importPerdu ? <p className="text-sm text-destructive">{t("ugcAtelier.importPerdu")}</p> : null}
        {modele.erreur ? <p className="text-sm text-destructive">{modele.erreur}</p> : null}
        {modele.source_path ? <Coupe modele={modele} /> : null}
        {modele.statut === "pret" ? (
          <>
            <Textes modele={modele} />
            <Rendus modele={modele} personas={personas} rendus={rendus} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Coupe({ modele }: { modele: UgcModele }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const video = React.useRef<HTMLVideoElement>(null);
  const [debut, setDebut] = React.useState(modele.reaction_debut_s ?? 0);
  const [fin, setFin] = React.useState(modele.reaction_fin_s ?? 0);
  const demo = modele.coupe_proposee?.demo_debut_s ?? null;
  const duree = fin - debut;
  const valide = dureeReactionValide(duree);

  const couper = useMutation({
    mutationFn: () => couperModele(modele.id, debut, fin, demo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ugc-atelier", "modeles"] }),
  });

  const aller = (s: number) => {
    if (video.current) video.current.currentTime = s;
  };
  const ici = () => Math.round((video.current?.currentTime ?? 0) * 100) / 100;

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <video ref={video} className="w-full rounded-md bg-black" src={urlMedia(modele.source_path) ?? undefined} controls playsInline />
      <div className="space-y-3">
        {modele.coupe_proposee ? (
          <p className="text-xs text-muted-foreground">
            {t("ugcAtelier.coupeProposee", {
              debut: modele.coupe_proposee.debut_s.toFixed(1),
              fin: modele.coupe_proposee.fin_s.toFixed(1),
            })}{" "}
            {modele.coupe_proposee.raison}
          </p>
        ) : null}
        {modele.planche.length ? (
          <div className="flex gap-1 overflow-x-auto pb-1">
            {modele.planche.map((i) => {
              const dedans = i.t >= debut && i.t <= fin;
              return (
                <button
                  key={i.url}
                  type="button"
                  onClick={() => aller(i.t)}
                  className={`shrink-0 rounded border-2 ${dedans ? "border-primary" : "border-transparent opacity-60"}`}
                  title={`${i.t.toFixed(2)} s`}
                >
                  <img src={i.url} alt={`${i.t.toFixed(2)} s`} className="h-24 w-auto rounded-sm" loading="lazy" />
                  <span className="block text-[10px] text-muted-foreground">{i.t.toFixed(1)} s</span>
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`debut-${modele.id}`}>{t("ugcAtelier.debut")}</Label>
            <Input
              id={`debut-${modele.id}`}
              className="w-24"
              type="number"
              step="0.1"
              value={debut}
              onChange={(e) => setDebut(Number(e.target.value))}
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setDebut(ici())}>
            {t("ugcAtelier.debutIci")}
          </Button>
          <div className="space-y-1">
            <Label htmlFor={`fin-${modele.id}`}>{t("ugcAtelier.fin")}</Label>
            <Input
              id={`fin-${modele.id}`}
              className="w-24"
              type="number"
              step="0.1"
              value={fin}
              onChange={(e) => setFin(Number(e.target.value))}
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setFin(ici())}>
            {t("ugcAtelier.finIci")}
          </Button>
          <Button type="button" disabled={!valide || couper.isPending} onClick={() => couper.mutate()}>
            {couper.isPending ? <Loader2 className="animate-spin" /> : <Scissors />}
            {modele.statut === "pret" ? t("ugcAtelier.recouper") : t("ugcAtelier.couper")}
          </Button>
        </div>
        <p className={`text-xs ${valide ? "text-muted-foreground" : "text-destructive"}`}>
          {t("ugcAtelier.dureeReaction", { s: duree.toFixed(1), min: REACTION_MIN_S, max: REACTION_MAX_S })}
        </p>
        {couper.error ? <p className="text-sm text-destructive">{couper.error.message}</p> : null}
        {modele.statut === "pret" ? (
          <div className="flex flex-wrap gap-3">
            <video className="h-48 rounded-md bg-black" src={urlMedia(modele.reaction_path) ?? undefined} controls playsInline />
            {modele.image_ref_path ? (
              <img className="h-48 rounded-md" src={urlMedia(modele.image_ref_path) ?? undefined} alt={t("ugcAtelier.imageRef")} />
            ) : null}
            {modele.image_propre_path ? (
              <img className="h-48 rounded-md" src={urlMedia(modele.image_propre_path) ?? undefined} alt={t("ugcAtelier.imagePropre")} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Textes({ modele }: { modele: UgcModele }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const lire = (segment: SegmentTexte["segment"]) => modele.textes.find((s) => s.segment === segment)?.texte ?? "";
  const [reaction, setReaction] = React.useState(lire("reaction"));
  const [demo, setDemo] = React.useState(lire("demo"));

  const enregistrer = useMutation({
    mutationFn: () =>
      enregistrerTextes(modele.id, [
        { segment: "reaction", texte: reaction },
        { segment: "demo", texte: demo },
      ]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ugc-atelier", "modeles"] }),
  });

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("ugcAtelier.textesTitre")}</p>
      <p className="text-xs text-muted-foreground">{t("ugcAtelier.textesDesc")}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`txt-r-${modele.id}`}>{t("ugcAtelier.texteReaction")}</Label>
          <Textarea id={`txt-r-${modele.id}`} rows={3} value={reaction} onChange={(e) => setReaction(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`txt-d-${modele.id}`}>{t("ugcAtelier.texteDemo")}</Label>
          <Textarea id={`txt-d-${modele.id}`} rows={3} value={demo} onChange={(e) => setDemo(e.target.value)} />
        </div>
      </div>
      <Button type="button" size="sm" variant="outline" disabled={enregistrer.isPending} onClick={() => enregistrer.mutate()}>
        {enregistrer.isPending ? <Loader2 className="animate-spin" /> : <Check />}
        {t("ugcAtelier.enregistrer")}
      </Button>
    </div>
  );
}

function Rendus({ modele, personas, rendus }: { modele: UgcModele; personas: PersonaAtelier[]; rendus: UgcRendu[] }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [personaId, setPersonaId] = React.useState(personas[0]?.id ?? "");
  const [moteur, setMoteur] = React.useState<MoteurKling>(MOTEUR_DEFAUT);
  const [decor, setDecor] = React.useState<"persona" | "source">("persona");
  const duree = Number(modele.reaction_fin_s ?? 0) - Number(modele.reaction_debut_s ?? 0);
  const nomPersona = (id: string) => personas.find((p) => p.id === id)?.nom ?? id.slice(0, 8);

  React.useEffect(() => {
    if (!personaId && personas[0]) setPersonaId(personas[0].id);
  }, [personaId, personas]);

  const lancer = useMutation({
    mutationFn: () => lancerRendu({ modele_id: modele.id, persona_id: personaId, moteur, decor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ugc-atelier", "rendus"] }),
  });

  // Une version par persona. Un rendu déjà vivant pour un persona est sauté
  // (la base refuse le doublon), les autres partent quand même.
  const lancerTous = useMutation({
    mutationFn: async () => {
      const refus: string[] = [];
      for (const p of personas) {
        try {
          await lancerRendu({ modele_id: modele.id, persona_id: p.id, moteur, decor });
        } catch (e) {
          refus.push(`${p.nom} : ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (refus.length) throw new Error(refus.join(" · "));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["ugc-atelier", "rendus"] }),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t("ugcAtelier.rendusTitre")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <select className={selectClass} value={personaId} onChange={(e) => setPersonaId(e.target.value)} aria-label={t("ugcAtelier.persona")}>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={moteur}
          onChange={(e) => setMoteur(e.target.value as MoteurKling)}
          aria-label={t("ugcAtelier.moteur")}
        >
          {(Object.keys(MOTEURS_KLING) as MoteurKling[]).map((m) => (
            <option key={m} value={m}>
              {m} · {MOTEURS_KLING[m].prixParSeconde.toFixed(3)} $/s
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={decor}
          onChange={(e) => setDecor(e.target.value as "persona" | "source")}
          aria-label={t("ugcAtelier.decor")}
        >
          <option value="persona">{t("ugcAtelier.decorPersona")}</option>
          <option value="source">{t("ugcAtelier.decorSource")}</option>
        </select>
        <Button type="button" disabled={!personaId || lancer.isPending} onClick={() => lancer.mutate()}>
          {lancer.isPending ? <Loader2 className="animate-spin" /> : <Play />}
          {t("ugcAtelier.lancer", { cout: coutRendu(moteur, duree).toFixed(2) })}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={personas.length === 0 || lancerTous.isPending}
          onClick={() => lancerTous.mutate()}
        >
          {lancerTous.isPending ? <Loader2 className="animate-spin" /> : <Play />}
          {t("ugcAtelier.lancerTous", {
            n: personas.length,
            cout: (coutRendu(moteur, duree) * personas.length).toFixed(2),
          })}
        </Button>
      </div>
      {lancer.error ? <p className="text-sm text-destructive">{lancer.error.message}</p> : null}
      {lancerTous.error ? <p className="text-sm text-destructive">{lancerTous.error.message}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rendus.map((r) => (
          <CarteRendu key={r.id} rendu={r} persona={nomPersona(r.persona_id)} />
        ))}
      </div>
    </div>
  );
}

function CarteRendu({ rendu, persona }: { rendu: UgcRendu; persona: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const decider = useMutation({
    mutationFn: (v: { decision: "valide" | "rejete"; motif?: string }) => deciderRendu(rendu.id, v.decision, v.motif),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ugc-atelier", "rendus"] }),
  });

  return (
    <div className="space-y-2 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <Badge variant={badgeStatut(rendu.statut)}>{t(`ugcAtelier.statutRendu.${rendu.statut}`)}</Badge>
        <span className="font-medium">{persona}</span>
        <span className="text-muted-foreground">
          {rendu.moteur} · {t(rendu.decor === "source" ? "ugcAtelier.decorSource" : "ugcAtelier.decorPersona")}
        </span>
        {rendu.cout_usd != null ? <span className="text-muted-foreground">· {Number(rendu.cout_usd).toFixed(2)} $</span> : null}
      </div>
      <div className="flex gap-2">
        {rendu.image_persona_path ? (
          <img className="h-40 rounded" src={urlMedia(rendu.image_persona_path) ?? undefined} alt={t("ugcAtelier.imagePersona")} />
        ) : null}
        {rendu.video?.url ? <video className="h-40 rounded bg-black" src={rendu.video.url} controls playsInline loop /> : null}
        {rendu.statut === "en_cours" ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {t(rendu.etape === "image" ? "ugcAtelier.etapeImage" : "ugcAtelier.etapeKling")}
          </p>
        ) : null}
      </div>
      {rendu.erreur ? <p className="text-xs text-destructive">{rendu.erreur}</p> : null}
      {rendu.motif_rejet ? <p className="text-xs text-muted-foreground">{rendu.motif_rejet}</p> : null}
      {rendu.statut === "a_valider" || rendu.statut === "valide" || rendu.statut === "rejete" ? (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={rendu.statut === "valide" ? "default" : "outline"}
            disabled={decider.isPending}
            onClick={() => decider.mutate({ decision: "valide" })}
          >
            <Check />
            {t("ugcAtelier.valider")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={decider.isPending}
            onClick={() => {
              const motif = window.prompt(t("ugcAtelier.motifRejet")) ?? undefined;
              decider.mutate({ decision: "rejete", motif });
            }}
          >
            <X />
            {t("ugcAtelier.rejeter")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CarteDemos() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const demos = useQuery({ queryKey: ["ugc-atelier", "demos"], queryFn: listerDemos });
  const [fichier, setFichier] = React.useState<File | null>(null);
  const [langue, setLangue] = React.useState<string>("fr");
  const [titre, setTitre] = React.useState("");

  const ajouter = useMutation({
    mutationFn: () => ajouterDemo(fichier as File, langue, titre),
    onSuccess: () => {
      setFichier(null);
      setTitre("");
      void qc.invalidateQueries({ queryKey: ["ugc-atelier", "demos"] });
    },
  });
  const basculer = useMutation({
    mutationFn: (v: { id: string; actif: boolean }) => basculerDemo(v.id, v.actif),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ugc-atelier", "demos"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("ugcAtelier.demosTitre")}</CardTitle>
        <CardDescription>{t("ugcAtelier.demosDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <Input
            type="file"
            accept="video/mp4"
            className="max-w-xs"
            onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
            aria-label={t("ugcAtelier.fichier")}
          />
          <select className={selectClass} value={langue} onChange={(e) => setLangue(e.target.value)} aria-label={t("ugcAtelier.langue")}>
            {LANGUES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <Input className="max-w-xs" placeholder={t("ugcAtelier.titreDemo")} value={titre} onChange={(e) => setTitre(e.target.value)} />
          <Button type="button" disabled={!fichier || ajouter.isPending} onClick={() => ajouter.mutate()}>
            {ajouter.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
            {t("ugcAtelier.ajouter")}
          </Button>
        </div>
        {ajouter.error ? <p className="text-sm text-destructive">{ajouter.error.message}</p> : null}
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(demos.data ?? []).map((d) => (
            <div key={d.id} className={`space-y-1 rounded-md border p-2 ${d.actif ? "" : "opacity-50"}`}>
              {d.media?.url ? <video className="h-40 w-full rounded bg-black" src={d.media.url} controls playsInline /> : null}
              <div className="flex items-center justify-between gap-1 text-xs">
                <span className="line-clamp-1">
                  <Badge variant="outline">{d.langue}</Badge> {d.titre}
                </span>
                <button className="underline" type="button" onClick={() => basculer.mutate({ id: d.id, actif: !d.actif })}>
                  {d.actif ? t("ugcAtelier.desactiver") : t("ugcAtelier.activer")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
