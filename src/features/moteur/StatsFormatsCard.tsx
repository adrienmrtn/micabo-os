import * as React from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listerLabels } from "@/features/moteur/api";
import { useApplication } from "@/features/moteur/ApplicationContext";
import { chargerStatsFormats, listerFormats } from "@/features/moteur/fileValidationApi";
import { LANGUES_CIBLES, nomLangue } from "@/features/moteur/langues";
import { agregerStatsFormats } from "@/features/moteur/statsFormats";
import { TIERS } from "@/features/moteur/tierlist";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Ce que chaque format rapporte, seul ou croisé avec un label.
 *
 * Le format ne pilote rien dans l'assignation — cette carte est sa seule
 * raison d'exister : voir si « storytime » marche mieux que « liste », et
 * dans quelle niche.
 */
export function StatsFormatsCard() {
  const { t, i18n } = useTranslation();
  const { applicationId } = useApplication();
  const [parLabel, setParLabel] = React.useState(false);
  const [langue, setLangue] = React.useState("");
  const [depuis, setDepuis] = React.useState("");
  const [jusqua, setJusqua] = React.useState("");

  const donnees = useQuery({
    queryKey: ["stats-formats", applicationId],
    queryFn: () => chargerStatsFormats(applicationId),
  });
  const formats = useQuery({ queryKey: ["formats"], queryFn: () => listerFormats() });
  const labels = useQuery({
    queryKey: ["labels", applicationId],
    queryFn: () => listerLabels(applicationId),
  });

  const nomFormat = React.useMemo(() => {
    const m = new Map((formats.data ?? []).map((f) => [f.id, f]));
    return (id: string | null) => (id ? (m.get(id)?.nom ?? "—") : t("statsFormats.aucun"));
  }, [formats.data, t]);
  const nomLabel = React.useMemo(() => {
    const m = new Map((labels.data ?? []).map((l) => [l.id, l.nom]));
    return (id: string | null) => (id ? (m.get(id) ?? "—") : t("statsFormats.sansLabel"));
  }, [labels.data, t]);

  const lignes = React.useMemo(() => {
    const d = donnees.data;
    if (!d) return [];
    return agregerStatsFormats(d.contenus, d.passages, {
      parLabel,
      langue: langue || null,
      depuis: depuis || null,
      jusqua: jusqua || null,
    });
  }, [donnees.data, parLabel, langue, depuis, jusqua]);

  const nombre = (n: number | null) =>
    n == null ? "—" : Math.round(n).toLocaleString(i18n.language);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("statsFormats.titre")}</CardTitle>
        <CardDescription>{t("statsFormats.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="sf-langue">{t("statsFormats.langue")}</Label>
            <select
              id="sf-langue"
              className={selectClass}
              value={langue}
              onChange={(e) => setLangue(e.target.value)}
            >
              <option value="">{t("statsFormats.toutesLangues")}</option>
              {LANGUES_CIBLES.map((l) => (
                <option key={l} value={l}>
                  {nomLangue(l)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sf-depuis">{t("statsFormats.depuis")}</Label>
            <Input
              id="sf-depuis"
              type="date"
              value={depuis}
              onChange={(e) => setDepuis(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sf-jusqua">{t("statsFormats.jusqua")}</Label>
            <Input
              id="sf-jusqua"
              type="date"
              value={jusqua}
              onChange={(e) => setJusqua(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={parLabel}
                onChange={(e) => setParLabel(e.target.checked)}
              />
              {t("statsFormats.croiserLabel")}
            </label>
          </div>
        </div>

        {donnees.isPending && (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        )}
        {donnees.isError && (
          <p className="text-sm text-destructive">{(donnees.error as Error).message}</p>
        )}
        {!donnees.isPending && lignes.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("statsFormats.vide")}</p>
        )}

        {lignes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-2">{t("statsFormats.colFormat")}</th>
                  {parLabel && <th className="py-1.5 pr-2">{t("statsFormats.colLabel")}</th>}
                  <th className="py-1.5 pr-2 text-right">{t("statsFormats.colVues")}</th>
                  <th className="py-1.5 pr-2 text-right">{t("statsFormats.colPassages")}</th>
                  <th className="py-1.5 pr-2 text-right">{t("statsFormats.colSlideshows")}</th>
                  <th className="py-1.5 pr-2">{t("statsFormats.colTiers")}</th>
                  <th className="py-1.5 text-right">{t("statsFormats.colMouvement")}</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={`${l.formatId ?? "-"}|${l.labelId ?? "-"}`} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 font-medium">{nomFormat(l.formatId)}</td>
                    {parLabel && <td className="py-1.5 pr-2">{nomLabel(l.labelId)}</td>}
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {nombre(l.vuesMoyennes)}
                      {l.mesures > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({l.mesures})
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{l.passages}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{l.slideshows}</td>
                    <td className="py-1.5 pr-2">
                      <span className="flex flex-wrap gap-1">
                        {TIERS.filter((x) => l.tiers[x]).map((x) => (
                          <Badge key={x} variant="outline" className="text-[10px]">
                            {x} {l.tiers[x]}
                          </Badge>
                        ))}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {l.montees > 0 && <span className="text-success">↑{l.montees}</span>}
                      {l.montees > 0 && l.descentes > 0 && " "}
                      {l.descentes > 0 && <span className="text-destructive">↓{l.descentes}</span>}
                      {l.montees === 0 && l.descentes === 0 && "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t("statsFormats.aide")}</p>
      </CardContent>
    </Card>
  );
}
