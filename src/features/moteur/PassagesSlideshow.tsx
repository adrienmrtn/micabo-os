import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lancerRattrapageElo, renseignerLienPublie } from "@/features/moteur/api";
import { nomLangue } from "@/features/moteur/langues";
import { bilanPassages, etatReleve } from "@/features/moteur/relevesStats";

/**
 * Le bilan d'un slideshow : qui l'a passé, quand, pour combien de vues, et le
 * lien du post.
 *
 * Extrait de la fiche slideshow pour servir aussi la file de validation. Les
 * 165 slideshows arrivés en file ont déjà tourné : c'est ce bilan, et pas le
 * visuel seul, qui dit s'il faut les garder. Même composant des deux côtés,
 * pour qu'un chiffre lu dans la file soit le chiffre de la fiche.
 */

export interface PassageAffiche {
  id: string;
  compte_id: string;
  post_id: string | null;
  langue: string;
  statut: string;
  date_publication_prevue: string | null;
  publie_at: string | null;
  publie_url: string | null;
  vues: number | null;
  likes: number | null;
  commentaires: number | null;
  stats_maj_at: string | null;
  comptes?: { handle_tiktok: string | null; persona_nom: string | null } | null;
}

/**
 * Dit pourquoi un passage n'a pas de vues.
 *
 * Sans cette ligne, un passage assigné (rien à mesurer) et un passage publié
 * jamais relevé (vrai raté) s'affichaient tous deux « — vues », ce qui donnait
 * l'impression que le relevé était cassé de bout en bout.
 */
function EtatRelevePassage({
  passage,
}: {
  passage: {
    statut: string;
    publie_at: string | null;
    vues: number | null;
    stats_maj_at: string | null;
    compte_id: string;
  };
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const etat = etatReleve(passage);

  const relever = useMutation({
    mutationFn: () => lancerRattrapageElo({ compteId: passage.compte_id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["slideshow"] });
      void queryClient.invalidateQueries({ queryKey: ["file"] });
    },
  });

  if (etat === "non_publie") return null;

  if (etat === "mesure") {
    return (
      <p className="text-[10px] text-muted-foreground">
        {passage.stats_maj_at
          ? t("slideshows.releveLe", {
              quand: new Date(passage.stats_maj_at).toLocaleString(i18n.language),
            })
          : t("slideshows.releveInconnu")}
      </p>
    );
  }

  if (etat === "trop_recent") {
    return <p className="text-[10px] text-muted-foreground">{t("slideshows.releveTropTot")}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-warning">{t("slideshows.releveManquant")}</span>
      <button
        type="button"
        disabled={relever.isPending}
        onClick={() => relever.mutate()}
        className="text-[10px] text-primary underline-offset-2 hover:underline"
      >
        {relever.isPending ? t("common.loading") : t("slideshows.releverMaintenant")}
      </button>
      {relever.isError && (
        <span className="text-[10px] text-destructive">
          {(relever.error as Error).message}
        </span>
      )}
    </div>
  );
}

function PassageLien({
  passageId,
  postId,
  publieUrl,
  statut,
  contenuId,
}: {
  passageId: string;
  postId: string | null;
  publieUrl: string | null;
  statut: string;
  contenuId: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const peutEditer = statut === "publie";
  const [edit, setEdit] = React.useState(peutEditer && !publieUrl);
  const [url, setUrl] = React.useState(publieUrl ?? "");
  const save = useMutation({
    mutationFn: () => renseignerLienPublie({ passageId, postId }, url),
    onSuccess: () => {
      setEdit(false);
      void queryClient.invalidateQueries({ queryKey: ["slideshow", contenuId] });
      void queryClient.invalidateQueries({ queryKey: ["file", "detail", contenuId] });
      void queryClient.invalidateQueries({ queryKey: ["publications-compte"] });
    },
  });

  if (!peutEditer && !publieUrl) return null;

  if (!edit && publieUrl) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <a
          href={publieUrl}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          TikTok ↗
        </a>
        {peutEditer && (
          <button
            type="button"
            className="text-muted-foreground underline underline-offset-2"
            onClick={() => {
              setUrl(publieUrl);
              setEdit(true);
            }}
          >
            {t("slideshows.modifierLien")}
          </button>
        )}
      </div>
    );
  }

  if (!edit) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={t("slideshows.lienPlaceholder")}
        className="h-7 min-w-[12rem] flex-1 text-xs"
      />
      <Button
        size="sm"
        className="h-7"
        disabled={save.isPending || !url.trim()}
        onClick={() => save.mutate()}
      >
        {save.isPending ? t("common.saving") : t("common.save")}
      </Button>
      {publieUrl && (
        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEdit(false)}>
          {t("common.cancel")}
        </Button>
      )}
    </div>
  );
}

export function PassagesSlideshow({
  contenuId,
  passages,
  chargement = false,
}: {
  contenuId: string;
  passages: PassageAffiche[];
  chargement?: boolean;
}) {
  const { t, i18n } = useTranslation();

  if (passages.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {chargement ? t("common.loading") : t("slideshows.pasDePassage")}
      </p>
    );
  }

  const r = bilanPassages(passages);

  return (
    <div className="space-y-2">
      <p className="text-xs tabular-nums text-muted-foreground">
        {t("slideshows.bilanPassages", {
          n: r.total,
          publies: r.publies,
          vues: r.vues.toLocaleString(i18n.language),
          moyenne: r.moyenne != null ? r.moyenne.toLocaleString(i18n.language) : "—",
        })}
      </p>
      <ul className="space-y-2">
        {passages.map((p) => (
          <li key={p.id} className="rounded border p-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-medium">
                {p.comptes?.persona_nom ||
                  p.comptes?.handle_tiktok ||
                  p.compte_id.slice(0, 8)}
              </span>
              <Badge variant="outline">{p.statut}</Badge>
            </div>
            <p className="text-muted-foreground">
              {p.date_publication_prevue
                ? new Date(p.date_publication_prevue).toLocaleDateString(i18n.language)
                : "—"}
              {" · "}
              {nomLangue(p.langue)}
            </p>
            <p className="tabular-nums text-muted-foreground">
              {t("slideshows.statsLigne", {
                vues: p.vues?.toLocaleString(i18n.language) ?? "—",
                likes: p.likes?.toLocaleString(i18n.language) ?? "—",
                coms: p.commentaires?.toLocaleString(i18n.language) ?? "—",
              })}
            </p>
            <EtatRelevePassage passage={p} />
            <PassageLien
              passageId={p.id}
              postId={p.post_id}
              publieUrl={p.publie_url}
              statut={p.statut}
              contenuId={contenuId}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
