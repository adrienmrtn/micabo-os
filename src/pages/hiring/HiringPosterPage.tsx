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
  listerLanguesReference,
  listerPosters,
} from "@/features/moteur/api";

/** Mot de passe commun à tous les posters (dicté de vive voix). */
const MOT_DE_PASSE = "12345678";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Écran unique du hiring manager : créer un poster. Il saisit prénom, nom et
 * choisit la LANGUE ; le compte de référence et la persona (pseudo, bio, avatar)
 * sont générés automatiquement par l'IA côté serveur.
 */
export function HiringPosterPage() {
  const { t } = useTranslation();
  const { profil } = useAuth();
  const queryClient = useQueryClient();

  const langues = useQuery({ queryKey: ["langues-reference"], queryFn: listerLanguesReference });
  const posters = useQuery({ queryKey: ["posters"], queryFn: listerPosters });

  const [prenom, setPrenom] = React.useState("");
  const [nom, setNom] = React.useState("");
  const [langue, setLangue] = React.useState("");
  const [cree, setCree] = React.useState<{ email: string; persona: boolean } | null>(null);

  // Un recruteur travaille DANS SA langue : si sa nationalité est posée et
  // dispo, la langue est verrouillée dessus (il ne crée que des créateurs de sa
  // langue). Sans nationalité, il choisit (repli).
  const langueVerrouillee =
    profil?.nationalite && langues.data?.includes(profil.nationalite) ? profil.nationalite : null;

  React.useEffect(() => {
    if (langue || !langues.data?.length) return;
    setLangue(langueVerrouillee ?? langues.data[0]);
  }, [langues.data, langue, langueVerrouillee]);

  const creer = useMutation({
    mutationFn: () => creerPoster({ prenom, nom, password: MOT_DE_PASSE, langue }),
    onSuccess: (r) => {
      setCree({ email: r.email, persona: Boolean(r.compte?.persona) });
      setPrenom("");
      setNom("");
      queryClient.invalidateQueries({ queryKey: ["posters"] });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            {t("hiring.title")}
          </CardTitle>
          <CardDescription>{t("hiring.subtitle")}</CardDescription>
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
              <Input id="prenom" required value={prenom} onChange={(e) => setPrenom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">{t("posters.nom")}</Label>
              <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="langue">{t("hiring.langue")}</Label>
              {langueVerrouillee ? (
                <div className={`${selectClass} flex items-center bg-muted/40`}>
                  {langueVerrouillee.toUpperCase()}
                </div>
              ) : (
                <select
                  id="langue"
                  className={selectClass}
                  value={langue}
                  onChange={(e) => setLangue(e.target.value)}
                  required
                >
                  {langues.data?.length === 0 && (
                    <option value="">{t("hiring.aucuneLangue")}</option>
                  )}
                  {langues.data?.map((l) => (
                    <option key={l} value={l}>
                      {l.toUpperCase()}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-muted-foreground">
                {langueVerrouillee ? t("hiring.langueVerrouillee") : t("hiring.langueAide")}
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={creer.isPending || !langue}>
                {creer.isPending ? t("hiring.enCours") : t("hiring.create")}
              </Button>
              {creer.isError && (
                <p className="mt-2 text-sm text-destructive">
                  {(creer.error as Error).message === "NO_FREE_REFERENCE"
                    ? t("posters.plusDeReference")
                    : (creer.error as Error).message}
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
                <code className="rounded bg-muted px-1">{MOT_DE_PASSE}</code>
              </p>
              <p className="pt-1 text-xs text-muted-foreground">
                {cree.persona ? t("hiring.personaOk") : t("hiring.personaPlusTard")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-5">
          {posters.isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          {posters.data?.filter((p) => p.role === "poster").length === 0 && (
            <EmptyState title={t("posters.empty")} />
          )}
          {posters.data
            ?.filter((p) => p.role === "poster")
            .map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-lg border p-3">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="size-11 shrink-0 rounded-full border object-cover" />
                ) : (
                  <div className="size-11 shrink-0 rounded-full border bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {[p.prenom, p.nom].filter(Boolean).join(" ") || p.email}
                    </span>
                    {!p.is_active && <Badge variant="secondary">{t("posters.disabled")}</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>

                  {/* Identité TikTok du compte (générée par l'IA) : le HM la vérifie. */}
                  <div className="mt-1.5 space-y-1 border-t pt-1.5">
                    {p.handle_tiktok ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                        <a
                          href={`https://www.tiktok.com/@${p.handle_tiktok.replace(/^@/, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-primary underline underline-offset-2"
                        >
                          @{p.handle_tiktok.replace(/^@/, "")}
                        </a>
                        {p.persona_nom && <span className="text-muted-foreground">{p.persona_nom}</span>}
                        {p.reference_handle && (
                          <span className="text-muted-foreground">
                            {t("hiring.source")} @{p.reference_handle.replace(/^@/, "")}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("hiring.identiteEnCours")}</p>
                    )}
                    {p.persona_bio && (
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{p.persona_bio}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
