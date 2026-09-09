import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, GitCompare } from "lucide-react";

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
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  essaiRestantMs,
  formaterCountdownEssai,
  type CompteEssai,
  type TiktokEssai,
} from "@/features/moteur/essai";
import { listerComptesEssai } from "@/features/moteur/essaiListe";
import { nomLangue } from "@/features/moteur/langues";
import { TikTokEmbed } from "@/features/reviews/TikTokEmbed";
import { cn } from "@/lib/utils";

function abrege(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function nomCompte(c: CompteEssai): string {
  return (
    [c.poster_prenom, c.poster_nom].filter(Boolean).join(" ") ||
    c.persona_nom ||
    (c.handle_tiktok ? `@${c.handle_tiktok}` : "—")
  );
}

function Tuile({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{valeur}</p>
    </div>
  );
}

function CarteEssai({
  compte,
  onComparer,
}: {
  compte: CompteEssai;
  onComparer: (tiktok: TiktokEssai) => void;
}) {
  const { t, i18n } = useTranslation();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const restant = essaiRestantMs(compte.created_at);
  const ratio = compte.dus > 0 ? Math.min(1, compte.publies / compte.dus) : 0;
  const ok = compte.publies >= compte.dus;
  const handle = compte.handle_tiktok?.replace(/^@/, "") ?? null;
  const tiktok = handle ? `https://www.tiktok.com/@${handle}` : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="size-12 shrink-0 overflow-hidden rounded-full bg-muted">
            {compte.avatar_url ? (
              <img src={compte.avatar_url} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-base">
              {nomCompte(compte)}
              {handle ? (
                <span className="ml-2 font-normal text-muted-foreground">@{handle}</span>
              ) : null}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge variant="info">{t("essai.badge", { temps: formaterCountdownEssai(restant) })}</Badge>
              <Badge variant="outline">{nomLangue(compte.langue)}</Badge>
              <span>{t("essai.quota", { n: compte.posts_par_jour })}</span>
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tiktok && (
              <Button size="sm" variant="outline" asChild>
                <a href={tiktok} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 size-3.5" />
                  {t("adminCreateur.compteTiktok")}
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to={`/admin/createurs/${compte.id}`}>{t("essai.fiche")}</Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{t("essai.publiesDus")}</span>
            <span className={cn("tabular-nums font-semibold", ok ? "text-success-foreground" : "")}>
              {compte.publies}/{compte.dus}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", ok ? "bg-success" : "bg-primary")}
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tuile label={t("essai.vues")} valeur={abrege(compte.vues)} />
          <Tuile label={t("essai.likes")} valeur={abrege(compte.likes)} />
          <Tuile label={t("essai.commentaires")} valeur={abrege(compte.commentaires)} />
          <Tuile label={t("essai.partages")} valeur={abrege(compte.partages)} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("essai.derniers")}
          </p>
          {compte.derniers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("essai.aucunTiktok")}</p>
          ) : (
            <ul className="space-y-1.5">
              {compte.derniers.map((tk) => (
                <li
                  key={tk.postId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {tk.titre?.trim() || t("reviewsJour.sansTitre")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tk.publieAt
                        ? new Date(tk.publieAt).toLocaleString(i18n.language)
                        : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" asChild>
                      <a href={tk.publieUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1.5 size-3.5" />
                        {t("reviewsJour.poste")}
                      </a>
                    </Button>
                    {tk.sourceUrl && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={tk.sourceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1.5 size-3.5" />
                          {t("reviewsJour.origine")}
                        </a>
                      </Button>
                    )}
                    <Button size="sm" onClick={() => onComparer(tk)}>
                      <GitCompare className="mr-1.5 size-3.5" />
                      {t("essai.comparer")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminEssaiPage() {
  const { t, i18n } = useTranslation();
  const [compare, setCompare] = React.useState<TiktokEssai | null>(null);

  const comptes = useQuery({
    queryKey: ["comptes-essai"],
    queryFn: () => listerComptesEssai(),
    refetchInterval: 60_000,
  });

  const liste = comptes.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("essai.title")}</CardTitle>
          <CardDescription>{t("essai.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {comptes.isPending && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {comptes.isError && (
            <p className="text-sm text-destructive">
              {(comptes.error as Error).message}
            </p>
          )}
          {!comptes.isPending && liste.length === 0 && (
            <EmptyState title={t("essai.videTitre")} description={t("essai.videAide")} />
          )}
          {!comptes.isPending && liste.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("essai.restants", { count: liste.length })}
            </p>
          )}
        </CardContent>
      </Card>

      {liste.map((c) => (
        <CarteEssai key={c.id} compte={c} onComparer={setCompare} />
      ))}

      <Dialog open={Boolean(compare)} onOpenChange={(open) => !open && setCompare(null)}>
        <DialogPopup className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("essai.comparerTitre")}</DialogTitle>
            <DialogDescription>
              {compare?.titre?.trim() || t("reviewsJour.sansTitre")}
              {compare?.publieAt
                ? ` · ${new Date(compare.publieAt).toLocaleString(i18n.language)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            {compare && (
              <div className="flex flex-col gap-4 lg:flex-row">
                <TikTokEmbed url={compare.sourceUrl} label={t("reviewsJour.origine")} />
                <TikTokEmbed url={compare.publieUrl} label={t("reviewsJour.poste")} />
              </div>
            )}
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
