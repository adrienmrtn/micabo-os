import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { chargerPoolGlobal } from "@/features/moteur/api";
import {
  concentration,
  goulotPool,
  horsJeu,
  joursAutonomie,
  tirablesMaintenant,
  verdictPoolGlobal,
} from "../../../supabase/functions/_shared/pool_global";
import { PART_TIRAGE_C } from "@/features/moteur/tierlist";

/** Un étage de l'entonnoir, avec sa part de la bibliothèque. */
function Etage({
  libelle,
  valeur,
  total,
  ton = "neutre",
  aide,
}: {
  libelle: string;
  valeur: number;
  total: number;
  ton?: "neutre" | "bon" | "perte";
  aide?: string;
}) {
  const pct = total > 0 ? Math.round((valeur / total) * 100) : 0;
  const barre =
    ton === "bon" ? "bg-success" : ton === "perte" ? "bg-muted-foreground/40" : "bg-primary/60";
  return (
    <div className="space-y-1" title={aide}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{libelle}</span>
        <span className="text-xs font-medium tabular-nums">
          {valeur}
          <span className="ml-1 text-[10px] text-muted-foreground">{pct}%</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${barre}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

/**
 * Où part le stock de slideshows, et pour combien de temps.
 *
 * La bibliothèque ne dit rien de ce que le moteur peut réellement tirer : il
 * exige `statut = 'valide'`, un cycle ouvert, des passages encore dus — et il
 * ne descend sur les C que si plus aucun B+ n'en doit. Chacun de ces étages
 * coûte des slideshows, et aucun n'était visible. D'où l'entonnoir.
 */
export function PoolGlobalCard() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["pool-global"],
    queryFn: chargerPoolGlobal,
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("pool.titre")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{t("pool.chargement")}</CardContent>
      </Card>
    );
  }

  const c = data.comptages;
  const tirables = tirablesMaintenant(c);
  const geles = horsJeu(c);
  const jours = joursAutonomie(c);
  const verdict = verdictPoolGlobal(c);
  const top5 = concentration(data.passagesParContenu, 5);

  const tonVerdict =
    verdict === "critique" ? "destructive" : verdict === "tendu" ? "warning" : "success";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{t("pool.titre")}</CardTitle>
            <CardDescription>{t("pool.sousTitre")}</CardDescription>
          </div>
          <Badge variant={tonVerdict as never}>
            {jours === null
              ? t("pool.aucuneConso")
              : t("pool.autonomie", { jours: jours.toFixed(1) })}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* L'entonnoir : chaque étage retire des slideshows au tirage. */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Etage
            libelle={t("pool.bibliotheque")}
            valeur={c.bibliotheque}
            total={c.bibliotheque}
            aide={t("pool.bibliothequeAide")}
          />
          <Etage
            libelle={t("pool.valides")}
            valeur={c.valides}
            total={c.bibliotheque}
            ton="bon"
            aide={t("pool.validesAide", { brouillons: c.brouillons, rejetes: c.rejetes })}
          />
          <Etage
            libelle={t("pool.cyclesOuverts")}
            valeur={c.cyclesOuverts}
            total={c.bibliotheque}
            aide={t("pool.cyclesOuvertsAide", { geles })}
          />
          <Etage
            libelle={t("pool.tirables")}
            valeur={tirables}
            total={c.bibliotheque}
            ton={tirables === 0 ? "perte" : "bon"}
            aide={t("pool.tirablesAide", { part: Math.round(PART_TIRAGE_C * 100) })}
          />
        </div>

        {/* Ce que l'entonnoir laisse sur le bord de la route. */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{t("pool.enAttenteValidation", { n: c.brouillons })}</span>
          <span>{t("pool.dusC", { n: c.dusC })}</span>
          <span>{t("pool.gelesCyclePlein", { n: geles })}</span>
          <span>{t("pool.passagesDus", { n: c.passagesDus })}</span>
          <span>{t("pool.consommation", { n: c.postsParJour })}</span>
        </div>

        {/* La distribution : « pourquoi toujours les mêmes ». */}
        <div className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{t("pool.distribution")}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("pool.distributionChiffre", {
                pct: Math.round(top5 * 100),
                distincts: data.distinctsAujourdhui,
              })}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{goulotPool(c)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
