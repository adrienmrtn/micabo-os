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
  definirRole,
  listerLanguesReference,
  listerPosters,
  majPoster,
  supprimerPoster,
} from "@/features/moteur/api";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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
  const changerRole = useMutation({
    mutationFn: (input: { id: string; role: "poster" | "hiring_manager" }) =>
      definirRole(input.id, input.role),
    onSuccess: rafraichir,
  });
  const basculer = useMutation({
    mutationFn: (input: { id: string; actif: boolean }) =>
      majPoster(input.id, { is_active: input.actif }),
    onSuccess: rafraichir,
  });
  const retirer = useMutation({ mutationFn: supprimerPoster, onSuccess: rafraichir });

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
        <CardContent className="space-y-2 pt-5">
          {posters.isPending && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {posters.data?.length === 0 && <EmptyState title={t("posters.empty")} />}

          {posters.data?.map((poster) => {
            const soiMeme = poster.id === user?.id;
            return (
              <div
                key={poster.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
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
                </div>

                {!soiMeme && (
                  <div className="flex flex-wrap gap-2">
                    {poster.role !== "admin" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={changerRole.isPending}
                        onClick={() =>
                          changerRole.mutate({
                            id: poster.id,
                            role: poster.role === "hiring_manager" ? "poster" : "hiring_manager",
                          })
                        }
                      >
                        {poster.role === "hiring_manager"
                          ? t("hiring.revoke")
                          : t("hiring.promote")}
                      </Button>
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
          })}
        </CardContent>
      </Card>
    </div>
  );
}
