import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle, EmptyState } from "@/components/ui/card";
import { mediasBrutsParSource, nettoyerTest, type MediaTest } from "@/features/moteur/api";

/** Borne le temps d'attente : le spinner ne doit jamais tourner indéfiniment,
 *  même si le nettoyage d'une image coince côté serveur. */
function avecTimeout<T>(promesse: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promesse,
    new Promise<T>((_, rejeter) =>
      setTimeout(() => rejeter(new Error("Trop long — réessaie.")), ms),
    ),
  ]);
}

/** Une vignette : image d'origine, bouton test, résultat nettoyé à côté. */
function CarteTest({ media }: { media: MediaTest }) {
  const { t } = useTranslation();

  const nettoyer = useMutation({
    mutationFn: () => avecTimeout(nettoyerTest(media.url), 90000),
  });
  const resultat = nettoyer.data;

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <div className="grid grid-cols-2 gap-2">
        <figure className="space-y-1">
          <figcaption className="text-[10px] font-medium uppercase text-muted-foreground">
            {t("testNet.avant")}
          </figcaption>
          <img src={media.url} alt="" className="aspect-[3/4] w-full rounded border object-cover" />
        </figure>
        <figure className="space-y-1">
          <figcaption className="text-[10px] font-medium uppercase text-muted-foreground">
            {t("testNet.apres")}
          </figcaption>
          {nettoyer.isPending ? (
            <div className="flex aspect-[3/4] items-center justify-center rounded border bg-muted/40 text-[11px] text-muted-foreground">
              {t("testNet.enCours")}
            </div>
          ) : resultat?.ok && resultat.url ? (
            <img src={resultat.url} alt="" className="aspect-[3/4] w-full rounded border object-cover" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center rounded border border-dashed bg-muted/20 p-1 text-center text-[10px] text-muted-foreground">
              {nettoyer.isError || (resultat && !resultat.ok)
                ? t("testNet.echec")
                : t("testNet.pasEncore")}
            </div>
          )}
        </figure>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="h-7 w-full text-xs"
        disabled={nettoyer.isPending}
        onClick={() => nettoyer.mutate()}
      >
        <Sparkles className="size-3" />
        {nettoyer.isPending ? t("testNet.enCours") : t("testNet.tester")}
      </Button>

      {(resultat && !resultat.ok) || nettoyer.isError ? (
        <p className="text-[10px] text-destructive">
          {resultat?.erreur ?? resultat?.motif ?? (nettoyer.error as Error)?.message}
        </p>
      ) : null}
    </div>
  );
}

export function AdminTestNettoyagePage() {
  const { t } = useTranslation();
  const groupes = useQuery({ queryKey: ["medias-bruts-test"], queryFn: mediasBrutsParSource });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("testNet.title")}</CardTitle>
          <CardDescription>{t("testNet.subtitle")}</CardDescription>
        </CardHeader>
      </Card>

      {groupes.isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {groupes.data?.length === 0 && <EmptyState title={t("testNet.vide")} />}

      {groupes.data?.map((groupe) => (
        <div key={groupe.source} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">@{groupe.source}</h2>
            <Badge variant="secondary">{groupe.medias.length}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {groupe.medias.map((media) => (
              <CarteTest key={media.id} media={media} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
