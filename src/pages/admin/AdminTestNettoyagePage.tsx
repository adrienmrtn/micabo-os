import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle, EmptyState } from "@/components/ui/card";
import { executerEnLot } from "@/lib/lot";
import { mediasBrutsParSource, nettoyerTest, type MediaTest } from "@/features/moteur/api";

/** État d'un test pour une image : au repos, en cours, réussi (url) ou échoué. */
type EtatTest =
  | { statut: "repos" }
  | { statut: "encours" }
  | { statut: "ok"; url: string; moteur?: "seedream" | "proxy" }
  | { statut: "echec"; erreur?: string };

const REPOS: EtatTest = { statut: "repos" };

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

/** Lance le nettoyage-test d'une image et renvoie son état final. */
async function testerImage(media: MediaTest): Promise<EtatTest> {
  try {
    const res = await avecTimeout(nettoyerTest(media.url), 130000);
    if (res.ok && res.url) return { statut: "ok", url: res.url, moteur: res.moteur };
    return { statut: "echec", erreur: res.erreur ?? res.motif };
  } catch (error) {
    return { statut: "echec", erreur: (error as Error)?.message };
  }
}

/** Vignette purement présentationnelle : origine, résultat, bouton. L'état et le
 *  déclenchement sont pilotés par le parent (pour le lot parallèle). */
function CarteTest({
  media,
  etat,
  onTester,
}: {
  media: MediaTest;
  etat: EtatTest;
  onTester: () => void;
}) {
  const { t } = useTranslation();
  const enCours = etat.statut === "encours";

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
          {enCours ? (
            <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded border bg-muted/40 px-2 text-center text-[11px] text-muted-foreground">
              <span>{t("testNet.enCours")}</span>
              <span className="font-medium text-foreground">{t("testNet.moteurSeedream")}</span>
            </div>
          ) : etat.statut === "ok" ? (
            <img src={etat.url} alt="" className="aspect-[3/4] w-full rounded border object-cover" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center rounded border border-dashed bg-muted/20 p-1 text-center text-[10px] text-muted-foreground">
              {etat.statut === "echec" ? t("testNet.echec") : t("testNet.pasEncore")}
            </div>
          )}
        </figure>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="h-7 w-full text-xs"
        disabled={enCours}
        onClick={onTester}
      >
        <Sparkles className="size-3" />
        {enCours ? t("testNet.enCours") : t("testNet.tester")}
      </Button>

      {etat.statut === "ok" && etat.moteur ? (
        <p className="text-[10px] text-muted-foreground">
          {etat.moteur === "seedream" ? t("testNet.viaSeedream") : t("testNet.viaProxy")}
        </p>
      ) : null}
      {etat.statut === "echec" && etat.erreur ? (
        <p className="text-[10px] text-destructive">{etat.erreur}</p>
      ) : null}
    </div>
  );
}

/** Un compte de référence : sa grille de photos + un bouton « tout tester » qui
 *  lance plusieurs agents en parallèle. */
function GroupeTest({ source, medias }: { source: string; medias: MediaTest[] }) {
  const { t } = useTranslation();
  const [etats, setEtats] = React.useState<Record<string, EtatTest>>({});
  const [lot, setLot] = React.useState<{ fait: number; total: number } | null>(null);

  const maj = (id: string, etat: EtatTest) => setEtats((e) => ({ ...e, [id]: etat }));

  async function lancerUn(media: MediaTest) {
    maj(media.id, { statut: "encours" });
    maj(media.id, await testerImage(media));
  }

  async function lancerTout() {
    setLot({ fait: 0, total: medias.length });
    setEtats(Object.fromEntries(medias.map((m) => [m.id, { statut: "encours" } as EtatTest])));
    await executerEnLot(medias, lancerUn, {
      onProgres: (fait, total) => setLot({ fait, total }),
    });
    setLot(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">@{source}</h2>
          <Badge variant="secondary">{medias.length}</Badge>
        </div>
        <Button size="sm" variant="outline" disabled={lot !== null} onClick={lancerTout}>
          <Sparkles className="size-3.5" />
          {lot
            ? t("adminPost.lotEnCours", { fait: lot.fait, total: lot.total })
            : t("testNet.toutTester")}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {medias.map((media) => (
          <CarteTest
            key={media.id}
            media={media}
            etat={etats[media.id] ?? REPOS}
            onTester={() => lancerUn(media)}
          />
        ))}
      </div>
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
        <GroupeTest key={groupe.source} source={groupe.source} medias={groupe.medias} />
      ))}
    </div>
  );
}
