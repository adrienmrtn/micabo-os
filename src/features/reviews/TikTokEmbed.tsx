import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";

import { resoudreTiktok } from "@/features/moteur/api";
import {
  estLienCourtTiktok,
  extraireIdTiktok,
  urlEmbedTikTok,
  urlEmbedTikTokDepuisId,
} from "@/features/reviews/fileQuotidienne";

export function TikTokEmbed({
  url,
  label,
}: {
  url: string | null;
  label: string;
}) {
  const { t } = useTranslation();
  const idDirect = extraireIdTiktok(url);
  const court = Boolean(url && !idDirect && estLienCourtTiktok(url));
  const resolu = useQuery({
    queryKey: ["tiktok-id", url],
    queryFn: () => resoudreTiktok(url!),
    enabled: court,
    staleTime: Infinity,
    retry: 1,
  });
  const embed = idDirect
    ? urlEmbedTikTok(url)
    : urlEmbedTikTokDepuisId(resolu.data ?? null);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {court && resolu.isPending ? (
        <div className="flex h-[520px] items-center justify-center rounded-lg border bg-muted/30 px-4 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : embed ? (
        <iframe
          title={label}
          src={embed}
          className="h-[520px] w-full rounded-lg border bg-muted/30"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <div className="flex h-[520px] items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
          {t("reviewsJour.embedIndispo")}
        </div>
      )}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ExternalLink className="size-3" />
          {t("reviewsJour.ouvrirTiktok")}
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">{t("reviewsJour.pasDeLien")}</p>
      )}
    </div>
  );
}
