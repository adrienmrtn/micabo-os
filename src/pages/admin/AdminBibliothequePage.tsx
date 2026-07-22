import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sparkles, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
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
  listerMedias,
  listerSources,
  nettoyerMedia,
  supprimerMedia,
} from "@/features/moteur/api";
import type { Media } from "@/features/moteur/types";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-64";

function estPropre(media: Media): boolean {
  return media.storage_path.startsWith("propre/");
}

function VignetteMedia({ media, onChange }: { media: Media; onChange: () => void }) {
  const { t } = useTranslation();
  const propre = estPropre(media);

  const nettoyer = useMutation({ mutationFn: () => nettoyerMedia(media.id), onSuccess: onChange });
  const supprimer = useMutation({ mutationFn: () => supprimerMedia(media.id), onSuccess: onChange });

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <img
          src={media.url}
          alt=""
          className={cn(
            "aspect-[3/4] w-full rounded-md border object-cover",
            !propre && "border-2 border-warning/60",
          )}
        />
        {!propre && (
          <span className="absolute inset-x-0 bottom-0 rounded-b-md bg-warning/85 py-0.5 text-center text-[10px] font-medium text-warning-foreground">
            {t("bibliotheque.texteRestant")}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {propre ? (
          <Badge variant="success">{t("bibliotheque.nettoyee")}</Badge>
        ) : (
          <Badge variant="warning">{t("bibliotheque.aNettoyer")}</Badge>
        )}
      </div>

      <div className="flex gap-1">
        {!propre && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 flex-1 px-2 text-xs"
            disabled={nettoyer.isPending}
            onClick={() => nettoyer.mutate()}
          >
            <Sparkles className="size-3" />
            {nettoyer.isPending ? t("bibliotheque.nettoyageEnCours") : t("bibliotheque.nettoyer")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          disabled={supprimer.isPending}
          onClick={() => {
            if (window.confirm(t("bibliotheque.confirmSuppr"))) supprimer.mutate();
          }}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>

      {nettoyer.data && !nettoyer.data.nettoyee && (
        <p className="text-[11px] text-destructive">{t("bibliotheque.nettoyageEchec")}</p>
      )}
    </div>
  );
}

export function AdminBibliothequePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [sourceId, setSourceId] = React.useState("");
  const [lot, setLot] = React.useState<{ fait: number; total: number } | null>(null);

  const sources = useQuery({ queryKey: ["sources"], queryFn: listerSources });
  const medias = useQuery({
    queryKey: ["medias", sourceId || "tous"],
    queryFn: () => listerMedias(sourceId || undefined),
  });

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ["medias"] });
  const aNettoyerListe = (medias.data ?? []).filter((m) => !estPropre(m));
  const aNettoyer = aNettoyerListe.length;

  /** Nettoie tous les visuels à texte en parallèle (3 à la fois). */
  async function nettoyerTout() {
    setLot({ fait: 0, total: aNettoyerListe.length });
    let index = 0;
    let fait = 0;
    async function travailleur() {
      while (index < aNettoyerListe.length) {
        const media = aNettoyerListe[index++];
        try {
          await nettoyerMedia(media.id);
        } catch {
          // un échec isolé ne stoppe pas le lot
        }
        fait += 1;
        setLot({ fait, total: aNettoyerListe.length });
      }
    }
    await Promise.all(Array.from({ length: 3 }, travailleur));
    setLot(null);
    rafraichir();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{t("bibliotheque.title")}</CardTitle>
            <CardDescription>
              {aNettoyer > 0
                ? t("bibliotheque.compteur", { count: aNettoyer })
                : t("bibliotheque.subtitle")}
            </CardDescription>
          </div>
          {aNettoyer > 0 && (
            <Button size="sm" disabled={lot !== null} onClick={nettoyerTout}>
              <Sparkles />
              {lot
                ? t("adminPost.lotEnCours", { fait: lot.fait, total: lot.total })
                : t("bibliotheque.nettoyerTout", { count: aNettoyer })}
            </Button>
          )}
        </div>
        {lot && <p className="pt-1 text-xs text-muted-foreground">{t("adminPost.lotAide")}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <select
          aria-label={t("comptes.source")}
          className={selectClass}
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
        >
          <option value="">{t("bibliotheque.toutes")}</option>
          {sources.data?.map((s) => (
            <option key={s.id} value={s.id}>
              @{s.handle_tiktok}
            </option>
          ))}
        </select>

        {medias.isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
        {medias.data?.length === 0 && <EmptyState title={t("bibliotheque.empty")} />}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {medias.data?.map((media) => (
            <VignetteMedia key={media.id} media={media} onChange={rafraichir} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
