import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nomLangue } from "@/features/moteur/langues";
import type { VersionIncrustee } from "@/features/moteur/texteIncruste";

/**
 * Les versions d'un slideshow à texte incrusté (0306), une par langue.
 *
 * Le texte est dans l'image : il n'y a rien à corriger slide par slide, ni CTA
 * à cocher. On montre ce qui partira chez un créateur de chaque langue — et une
 * version incomplète est signalée, parce que l'assignation ne la servira pas.
 */
export function VersionsIncrustees({
  versions,
  hashtags,
  onHashtags,
  disabled,
}: {
  versions: VersionIncrustee[];
  /** Hashtags par langue. Sans `onHashtags`, lecture seule. */
  hashtags?: Record<string, string>;
  onHashtags?: (langue: string, valeur: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("incruste.titre")}</CardTitle>
        <CardDescription>{t("incruste.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {versions.length === 0 && (
          <p className="text-sm text-destructive">{t("incruste.aucuneVersion")}</p>
        )}
        {versions.map((v) => (
          <div key={v.langue} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {v.langue.toUpperCase()} · {nomLangue(v.langue)}
              </span>
              {v.prete ? (
                <Badge variant="success">{t("incruste.prete", { n: v.images.length })}</Badge>
              ) : (
                <Badge variant="error">{t("incruste.incomplete")}</Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {v.images.map((img) =>
                img.url ? (
                  <a key={img.position} href={img.url} target="_blank" rel="noreferrer">
                    <img
                      src={img.url}
                      alt={`${v.langue} #${img.position}`}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[1080/1342] w-full rounded border object-cover"
                    />
                  </a>
                ) : (
                  <div
                    key={img.position}
                    className="flex aspect-[1080/1342] items-center justify-center rounded border border-dashed text-[10px] text-destructive"
                  >
                    #{img.position}
                  </div>
                ),
              )}
            </div>
            {hashtags && (
              <div className="space-y-1">
                <Label htmlFor={`incruste-hashtags-${v.langue}`}>
                  {t("incruste.hashtags", { langue: v.langue.toUpperCase() })}
                </Label>
                {onHashtags ? (
                  <Input
                    id={`incruste-hashtags-${v.langue}`}
                    value={hashtags[v.langue] ?? ""}
                    disabled={disabled}
                    onChange={(e) => onHashtags(v.langue, e.target.value)}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">{hashtags[v.langue] || "—"}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
