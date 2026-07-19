import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFrames, useMarkAsPosted, usePosterSlideshow } from "./hooks";
import type { SlideshowFrame } from "./types";

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button size="sm" variant="outline" onClick={copy}>
      {copied ? t("delivery.copied") : t("delivery.copy")}
    </Button>
  );
}

function FrameCard({ frame }: { frame: SlideshowFrame }) {
  const { t } = useTranslation();
  const imageUrl = frame.cleaned_url ?? frame.original_url;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">{t("editor.slide", { position: frame.position })}</p>

      {imageUrl && (
        <>
          <img
            src={imageUrl}
            alt={`Slide ${frame.position}`}
            className="w-full rounded-md border object-contain"
          />
          {/* `download` ne force le téléchargement que sur même origine ; sur
              mobile l'appui long reste le geste fiable, d'où le rappel. */}
          <Button asChild size="sm" variant="outline" className="w-full">
            <a href={imageUrl} download target="_blank" rel="noreferrer">
              {t("delivery.downloadImage")}
            </a>
          </Button>
        </>
      )}

      {frame.translated_text && (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
            {frame.translated_text}
          </p>
          <CopyButton text={frame.translated_text} />
        </div>
      )}
    </div>
  );
}

export function DeliveryView({ slideshowId }: { slideshowId: string }) {
  const { t } = useTranslation();
  const { data: slideshow, isPending } = usePosterSlideshow(slideshowId);
  const { data: frames } = useFrames(slideshowId);
  const markAsPosted = useMarkAsPosted();
  const [postedUrl, setPostedUrl] = React.useState("");

  if (isPending) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!slideshow) {
    return <p className="text-sm text-destructive">{t("delivery.notFound")}</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {slideshow.hook_title || slideshow.title || t("today.untitled")}
          </CardTitle>
          {slideshow.suggested_creator_handle && (
            <CardDescription>
              {t("today.postOn", { handle: slideshow.suggested_creator_handle })}
            </CardDescription>
          )}
        </CardHeader>
        {slideshow.audio_url && (
          <CardContent className="space-y-2">
            <p className="text-sm font-medium">{t("delivery.audio")}</p>
            <audio controls src={slideshow.audio_url} className="w-full" />
            <Button asChild size="sm" variant="outline">
              <a href={slideshow.audio_url} download target="_blank" rel="noreferrer">
                {t("delivery.downloadAudio")}
              </a>
            </Button>
          </CardContent>
        )}
      </Card>

      <div className="space-y-4">
        {frames?.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("delivery.noFrames")}</p>
        )}
        {frames?.map((frame) => (
          <FrameCard key={frame.id} frame={frame} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("delivery.markPostedTitle")}</CardTitle>
          <CardDescription>{t("delivery.markPostedBody")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {slideshow.posted_at ? (
            <p className="text-sm text-emerald-600">
              {t("delivery.postedOn", {
                date: new Date(slideshow.posted_at).toLocaleString(),
              })}
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="postedUrl">{t("delivery.postedUrl")}</Label>
                <Input
                  id="postedUrl"
                  type="url"
                  placeholder="https://www.tiktok.com/@..."
                  value={postedUrl}
                  onChange={(e) => setPostedUrl(e.target.value)}
                />
              </div>
              <Button
                disabled={markAsPosted.isPending}
                onClick={() => markAsPosted.mutate({ slideshowId, postedUrl })}
              >
                {markAsPosted.isPending ? t("common.saving") : t("delivery.markPosted")}
              </Button>
              {markAsPosted.isError && (
                <p className="text-sm text-destructive">
                  {(markAsPosted.error as Error).message}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
