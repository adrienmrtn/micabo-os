import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Eye, Radar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listerSources, testerScrape } from "@/features/moteur/api";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-72";

function abrege(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Teste le scrape d'un compte de référence : montre ses posts avec leurs VUES
 * (triés par vues), pour vérifier que le moteur repère bien les TikToks qui
 * performent. Ne crée rien.
 */
export function TestScrapeCard() {
  const { t } = useTranslation();
  const sources = useQuery({ queryKey: ["sources"], queryFn: listerSources });
  const [sourceId, setSourceId] = React.useState("");

  const tester = useMutation({ mutationFn: () => testerScrape(sourceId) });
  const posts = tester.data?.posts ?? [];

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radar className="size-4 text-primary" />
          {t("testScrape.title")}
        </CardTitle>
        <CardDescription>{t("testScrape.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t("testScrape.compte")}
            className={selectClass}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            <option value="">{t("common.none")}</option>
            {sources.data?.map((s) => (
              <option key={s.id} value={s.id}>
                @{s.handle_tiktok}
              </option>
            ))}
          </select>
          <Button disabled={!sourceId || tester.isPending} onClick={() => tester.mutate()}>
            <Eye className="size-4" />
            {tester.isPending ? t("testScrape.enCours") : t("testScrape.lancer")}
          </Button>
        </div>

        {tester.isError && (
          <p className="text-sm text-destructive">{(tester.error as Error).message}</p>
        )}

        {tester.data && posts.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("testScrape.vide")}</p>
        )}

        {posts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{t("testScrape.aide")}</p>
            {posts.map((p, i) => (
              <div
                key={p.url}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-2.5 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-5 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate underline-offset-2 hover:underline"
                  >
                    {p.texte || t("testScrape.sansTexte")}
                  </a>
                </div>
                <div className="flex shrink-0 items-center gap-2 tabular-nums">
                  {!p.estPhoto && <Badge variant="outline">{t("testScrape.pasPhoto")}</Badge>}
                  {p.dejaVu && <Badge variant="secondary">{t("testScrape.dejaVu")}</Badge>}
                  <span title={t("analytics.vues")}>👁 {abrege(p.vues)}</span>
                  <span title={t("analytics.likes")}>♥ {abrege(p.likes)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
