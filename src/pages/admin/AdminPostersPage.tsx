import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import { useAuth } from "@/features/auth/AuthContext";
import {
  creerPoster,
  creerRecruteur,
  definirRole,
  listerLanguesReference,
  listerPosters,
  majPoster,
  majUpwork,
  supprimerPoster,
} from "@/features/moteur/api";
import type { PosterProfil } from "@/features/moteur/types";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/** Liens directs pour checker vite un créateur : son compte TikTok (déduit du
 *  pseudo) et sa conversation Upwork (saisie par l'admin, éditable en ligne). */
function CreateurLiens({
  poster,
  onSave,
}: {
  poster: PosterProfil;
  onSave: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [edit, setEdit] = React.useState(false);
  const [url, setUrl] = React.useState(poster.upwork_url ?? "");
  const tiktok = poster.handle_tiktok
    ? `https://www.tiktok.com/@${poster.handle_tiktok.replace(/^@/, "")}`
    : null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {tiktok && (
        <a href={tiktok} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          TikTok ↗
        </a>
      )}
      {!edit && poster.upwork_url && (
        <a
          href={poster.upwork_url}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Upwork ↗
        </a>
      )}
      {!edit && (
        <button
          type="button"
          onClick={() => {
            setUrl(poster.upwork_url ?? "");
            setEdit(true);
          }}
          className="text-muted-foreground underline underline-offset-2"
        >
          {poster.upwork_url ? t("posters.upworkModifier") : t("posters.upworkAjouter")}
        </button>
      )}
      {edit && (
        <span className="flex items-center gap-1">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.upwork.com/…"
            className="h-7 w-56 text-xs"
          />
          <Button
            size="sm"
            className="h-7"
            onClick={() => {
              onSave(url);
              setEdit(false);
            }}
          >
            {t("common.save")}
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setEdit(false)}>
            {t("common.cancel")}
          </Button>
        </span>
      )}
    </div>
  );
}

/**
 * Mot de passe commun à tous les posters, simple à dicter au téléphone. Il
 * reste en place : on ne demande à personne d'en choisir un autre.
 */
const MOT_DE_PASSE_INITIAL = "12345678";

export function AdminPostersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const posters = useQuery({ queryKey: ["posters"], queryFn: listerPosters });
  const langues = useQuery({ queryKey: ["langues-reference"], queryFn: listerLanguesReference });

  const [prenom, setPrenom] = React.useState("");
  const [nom, setNom] = React.useState("");
  const [langue, setLangue] = React.useState("");
  const [password, setPassword] = React.useState(MOT_DE_PASSE_INITIAL);
  const [cree, setCree] = React.useState<{ email: string; password: string } | null>(null);

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["posters"] });

  const creer = useMutation({
    mutationFn: () => creerPoster({ prenom, nom, password, langue: langue || undefined }),
    onSuccess: (r) => {
      setCree({ email: r.email, password });
      setPrenom("");
      setNom("");
      setPassword(MOT_DE_PASSE_INITIAL);
      rafraichir();
    },
  });
  // Création directe d'un recruteur (hiring manager) par son nom.
  const [recPrenom, setRecPrenom] = React.useState("");
  const [recNom, setRecNom] = React.useState("");
  const [recLangue, setRecLangue] = React.useState("");
  const [recCree, setRecCree] = React.useState<{ email: string } | null>(null);
  const creerRec = useMutation({
    mutationFn: () => creerRecruteur({ prenom: recPrenom, nom: recNom, langue: recLangue || undefined }),
    onSuccess: (r) => {
      setRecCree({ email: r.email });
      setRecPrenom("");
      setRecNom("");
      rafraichir();
    },
  });

  const [promoId, setPromoId] = React.useState<string | null>(null);
  const [promoLangue, setPromoLangue] = React.useState("");
  const changerRole = useMutation({
    mutationFn: (input: { id: string; role: "poster" | "hiring_manager"; nationalite?: string }) =>
      definirRole(input.id, input.role, input.nationalite),
    onSuccess: () => {
      setPromoId(null);
      rafraichir();
    },
  });
  const basculer = useMutation({
    mutationFn: (input: { id: string; actif: boolean }) =>
      majPoster(input.id, { is_active: input.actif }),
    onSuccess: rafraichir,
  });
  const retirer = useMutation({ mutationFn: supprimerPoster, onSuccess: rafraichir });
  const enregistrerUpwork = useMutation({
    mutationFn: (input: { id: string; url: string }) => majUpwork(input.id, input.url),
    onSuccess: rafraichir,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            {t("posters.title")}
          </CardTitle>
          <CardDescription>{t("posters.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setCree(null);
              creer.mutate();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="prenom">{t("posters.prenom")}</Label>
              <Input
                id="prenom"
                required
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">{t("posters.nom")}</Label>
              <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="langue">{t("hiring.langue")}</Label>
              <select
                id="langue"
                className={selectClass}
                value={langue}
                onChange={(e) => setLangue(e.target.value)}
              >
                <option value="">{t("posters.sansCompte")}</option>
                {langues.data?.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t("posters.langueAide")}</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="mdp">{t("posters.password")}</Label>
              <div className="flex gap-2">
                <Input
                  id="mdp"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPassword(MOT_DE_PASSE_INITIAL)}
                >
                  {t("posters.regenerate")}
                </Button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={creer.isPending}>
                {creer.isPending ? t("common.saving") : t("posters.create")}
              </Button>
              {creer.isError && (
                <p className="mt-2 text-sm text-destructive">
                  {(creer.error as Error).message}
                </p>
              )}
            </div>
          </form>

          {cree && (
            <div className="space-y-1 rounded-lg border border-success/40 bg-success/5 p-4">
              <p className="text-sm font-medium text-success">{t("posters.done")}</p>
              <p className="text-sm">
                <span className="text-muted-foreground">{t("posters.emailGenere")} : </span>
                <code className="rounded bg-muted px-1">{cree.email}</code>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">{t("posters.password")} : </span>
                <code className="rounded bg-muted px-1">{cree.password}</code>
              </p>
              <p className="pt-1 text-xs text-muted-foreground">{t("posters.transmit")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            {t("posters.creerRecruteur")}
          </CardTitle>
          <CardDescription>{t("posters.creerRecruteurDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setRecCree(null);
              creerRec.mutate();
            }}
            className="grid gap-4 sm:grid-cols-3"
          >
            <div className="space-y-2">
              <Label htmlFor="recPrenom">{t("posters.prenom")}</Label>
              <Input id="recPrenom" required value={recPrenom} onChange={(e) => setRecPrenom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recNom">{t("posters.nom")}</Label>
              <Input id="recNom" value={recNom} onChange={(e) => setRecNom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recLangue">{t("hiring.langue")}</Label>
              <select
                id="recLangue"
                className={selectClass}
                value={recLangue}
                onChange={(e) => setRecLangue(e.target.value)}
              >
                <option value="">{t("common.none")}</option>
                {langues.data?.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={creerRec.isPending || !recPrenom.trim()}>
                {creerRec.isPending ? t("common.saving") : t("posters.creerRecruteur")}
              </Button>
              {creerRec.isError && (
                <p className="mt-2 text-sm text-destructive">{(creerRec.error as Error).message}</p>
              )}
              {recCree && (
                <p className="mt-2 text-sm text-success">
                  {t("posters.done")} — <code className="rounded bg-muted px-1">{recCree.email}</code> ·{" "}
                  <code className="rounded bg-muted px-1">12345678</code>
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {(() => {
        const tous = posters.data ?? [];
        const nomDe = (p: (typeof tous)[number]) =>
          [p.prenom, p.nom].filter(Boolean).join(" ") || p.email || "—";
        const recruteurs = tous.filter((p) => p.role === "hiring_manager");
        const creators = tous.filter((p) => p.role === "poster");
        const admins = tous.filter((p) => p.role === "admin");
        const parManager = new Map<string, typeof tous>();
        for (const c of creators) {
          const k = c.manager_id ?? "__none__";
          parManager.set(k, [...(parManager.get(k) ?? []), c]);
        }

        const ligne = (poster: (typeof tous)[number]) => {
          const soiMeme = poster.id === user?.id;
          return (
            <div
              key={poster.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3"
            >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {[poster.prenom, poster.nom].filter(Boolean).join(" ") || poster.email}
                    </span>
                    {soiMeme && <Badge variant="outline">{t("posters.you")}</Badge>}
                    {poster.role === "admin" && <Badge>{t("nav.admin")}</Badge>}
                    {poster.role === "hiring_manager" && (
                      <Badge variant="secondary">{t("hiring.badge")}</Badge>
                    )}
                    {!poster.is_active && (
                      <Badge variant="secondary">{t("posters.disabled")}</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{poster.email}</p>
                  <CreateurLiens
                    poster={poster}
                    onSave={(url) => enregistrerUpwork.mutate({ id: poster.id, url })}
                  />
                </div>

                {!soiMeme && (
                  <div className="flex flex-wrap gap-2">
                    {poster.role === "hiring_manager" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={changerRole.isPending}
                        onClick={() => changerRole.mutate({ id: poster.id, role: "poster" })}
                      >
                        {t("hiring.revoke")}
                      </Button>
                    )}
                    {poster.role === "poster" && promoId !== poster.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPromoId(poster.id);
                          setPromoLangue(langues.data?.[0] ?? "");
                        }}
                      >
                        {t("hiring.promote")}
                      </Button>
                    )}
                    {poster.role === "poster" && promoId === poster.id && (
                      <div className="flex items-center gap-1">
                        <select
                          aria-label={t("hiring.langue")}
                          className={`${selectClass} h-8 w-24`}
                          value={promoLangue}
                          onChange={(e) => setPromoLangue(e.target.value)}
                        >
                          {langues.data?.map((l) => (
                            <option key={l} value={l}>
                              {l.toUpperCase()}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          disabled={changerRole.isPending || !promoLangue}
                          onClick={() =>
                            changerRole.mutate({
                              id: poster.id,
                              role: "hiring_manager",
                              nationalite: promoLangue,
                            })
                          }
                        >
                          {t("hiring.valider")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPromoId(null)}>
                          {t("common.cancel")}
                        </Button>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        basculer.mutate({ id: poster.id, actif: !poster.is_active })
                      }
                    >
                      {poster.is_active ? t("posters.disable") : t("posters.enable")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (window.confirm(t("posters.confirmDelete")))
                          retirer.mutate(poster.id);
                      }}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                )}
            </div>
          );
        };

        if (posters.isPending) {
          return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
        }
        if (tous.length === 0) return <EmptyState title={t("posters.empty")} />;

        const section = (titre: string, count: number, membres: typeof tous, badge?: string) => (
          <Card key={titre}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">{titre}</CardTitle>
                <Badge variant="secondary">{count}</Badge>
                {badge && <Badge variant="outline">{badge}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {membres.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("posters.aucunCreateur")}</p>
              ) : (
                membres.map(ligne)
              )}
            </CardContent>
          </Card>
        );

        return (
          <div className="space-y-4">
            {recruteurs.length > 0 &&
              section(t("posters.recruteurs"), recruteurs.length, recruteurs, t("hiring.badge"))}
            {recruteurs.map((rec) =>
              section(nomDe(rec), (parManager.get(rec.id) ?? []).length, parManager.get(rec.id) ?? []),
            )}
            {(parManager.get("__none__") ?? []).length > 0 &&
              section(
                t("posters.sansRecruteur"),
                (parManager.get("__none__") ?? []).length,
                parManager.get("__none__") ?? [],
              )}
            {admins.length > 0 && section(t("nav.admin"), admins.length, admins)}
          </div>
        );
      })()}
    </div>
  );
}
