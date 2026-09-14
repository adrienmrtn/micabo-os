import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ajouterCompte } from "@/features/moteur/api";
import { useApplication } from "@/features/moteur/ApplicationContext";
import { nomApplication, type ApplicationOs } from "@/features/moteur/applications";
import { nomLangue } from "@/features/moteur/langues";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Ajout d'un compte TikTok à un créateur existant.
 *
 * Vient de `FormulaireCompteCm.tsx`, retiré avec CM paper (14/09/2026) : il n'y
 * a plus qu'un type de compte, donc plus de sélecteur ni d'identifiants CM.
 */
export function FormulaireAjouterCompte({
  posterId,
  languesProposees,
  applications,
  onCree,
}: {
  posterId: string;
  languesProposees: string[];
  applications?: ApplicationOs[];
  onCree?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [ouvert, setOuvert] = React.useState(false);
  const [langue, setLangue] = React.useState(languesProposees[0] ?? "");
  const [handle, setHandle] = React.useState("");
  const [postsParJour, setPostsParJour] = React.useState<1 | 2 | 3>(2);
  const { slug: slugContexte } = useApplication();
  const [applicationSlug, setApplicationSlug] = React.useState(
    slugContexte || applications?.[0]?.slug || "micabo",
  );

  React.useEffect(() => {
    if (slugContexte && (!applications?.length || applications.some((a) => a.slug === slugContexte))) {
      setApplicationSlug(slugContexte);
      return;
    }
    if (!applications?.length) return;
    if (applicationSlug && applications.some((a) => a.slug === applicationSlug)) return;
    setApplicationSlug(applications[0]!.slug);
  }, [applications, applicationSlug, slugContexte]);

  React.useEffect(() => {
    if (langue && languesProposees.includes(langue)) return;
    setLangue(languesProposees[0] ?? "");
  }, [languesProposees, langue]);

  const creer = useMutation({
    mutationFn: () =>
      ajouterCompte({
        posterId,
        langue,
        application_slug: applicationSlug,
        posts_par_jour: postsParJour,
        handle_tiktok: handle,
      }),
    onSuccess: () => {
      setHandle("");
      setPostsParJour(2);
      setOuvert(false);
      void queryClient.invalidateQueries({ queryKey: ["comptes"] });
      void queryClient.invalidateQueries({ queryKey: ["posters"] });
      onCree?.();
    },
  });

  if (!ouvert) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOuvert(true)}>
        {t("cm.ajouterCompte")}
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-md border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        creer.mutate();
      }}
    >
      <p className="text-sm font-medium">{t("cm.ajouterCompte")}</p>
      <p className="text-xs text-muted-foreground">{t("cm.ajouterPersoAide")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(applications ?? []).length > 1 && (
          <div className="space-y-1">
            <Label htmlFor={`compte-app-${posterId}`}>{t("applications.compte")}</Label>
            <select
              id={`compte-app-${posterId}`}
              className={selectClass}
              value={applicationSlug}
              onChange={(e) => setApplicationSlug(e.target.value)}
              required
            >
              {(applications ?? []).map((app) => (
                <option key={app.id} value={app.slug}>
                  {nomApplication(app)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor={`compte-langue-${posterId}`}>{t("cm.langueCompte")}</Label>
          <select
            id={`compte-langue-${posterId}`}
            className={selectClass}
            value={langue}
            onChange={(e) => setLangue(e.target.value)}
            required
          >
            {languesProposees.map((l) => (
              <option key={l} value={l}>
                {nomLangue(l)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`compte-handle-${posterId}`}>{t("comptes.pseudo")}</Label>
          <Input
            id={`compte-handle-${posterId}`}
            value={handle}
            placeholder={t("comptes.pseudoPlaceholder")}
            onChange={(e) => setHandle(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("comptes.pseudoFacultatif")}</p>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>{t("hiring.postsParJour")}</Label>
          <div className="inline-flex rounded-md border p-0.5">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPostsParJour(n)}
                className={
                  postsParJour === n
                    ? "rounded px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground"
                    : "rounded px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={creer.isPending || !langue}>
          {creer.isPending ? t("common.saving") : t("cm.creerCompte")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOuvert(false)}>
          {t("common.cancel")}
        </Button>
      </div>
      {creer.isError && (
        <p className="text-xs text-destructive">{(creer.error as Error).message}</p>
      )}
    </form>
  );
}
