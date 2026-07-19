import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAddFrame, useDeleteFrame, useFrames, useUpdateFrameText } from "./hooks";
import type { SlideshowFrame } from "./types";

function FrameRow({
  frame,
  slideshowId,
}: {
  frame: SlideshowFrame;
  slideshowId: string;
}) {
  const { t } = useTranslation();
  const updateText = useUpdateFrameText(slideshowId);
  const deleteFrame = useDeleteFrame(slideshowId);
  const [text, setText] = React.useState(frame.translated_text ?? "");

  const isDirty = text !== (frame.translated_text ?? "");

  return (
    <div className="flex flex-wrap gap-4 rounded-lg border p-3 sm:flex-nowrap">
      <div className="shrink-0">
        {frame.cleaned_url ? (
          <img
            src={frame.cleaned_url}
            alt={`Slide ${frame.position}`}
            className="h-32 w-24 rounded-md border object-cover"
          />
        ) : (
          <div className="flex h-32 w-24 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
            {frame.position}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {t("editor.slide", { position: frame.position })}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm(t("editor.confirmDeleteFrame")))
                deleteFrame.mutate(frame.id);
            }}
          >
            {t("common.delete")}
          </Button>
        </div>

        <Textarea
          rows={3}
          placeholder={t("editor.textPlaceholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {isDirty && (
          <Button
            size="sm"
            disabled={updateText.isPending}
            onClick={() =>
              updateText.mutate({ frameId: frame.id, translatedText: text })
            }
          >
            {updateText.isPending ? t("common.saving") : t("common.save")}
          </Button>
        )}
      </div>
    </div>
  );
}

export function SlideshowEditor({ slideshowId }: { slideshowId: string }) {
  const { t } = useTranslation();
  const { data: frames, isPending } = useFrames(slideshowId);
  const addFrame = useAddFrame(slideshowId);

  const [originalUrl, setOriginalUrl] = React.useState("");
  const [translatedText, setTranslatedText] = React.useState("");

  const nextPosition = (frames?.length ?? 0) + 1;

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!originalUrl.trim()) return;

    await addFrame.mutateAsync({
      position: nextPosition,
      originalUrl,
      translatedText,
    });
    setOriginalUrl("");
    setTranslatedText("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("editor.title")}</CardTitle>
        <CardDescription>{t("editor.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          {isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          {frames?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("editor.noFrames")}</p>
          )}
          {frames?.map((frame) => (
            <FrameRow key={frame.id} frame={frame} slideshowId={slideshowId} />
          ))}
        </div>

        <form onSubmit={handleAdd} className="space-y-4 rounded-lg border border-dashed p-4">
          <p className="text-sm font-medium">
            {t("editor.addFrame", { position: nextPosition })}
          </p>

          <div className="space-y-2">
            <Label htmlFor="originalUrl">{t("editor.imageUrl")}</Label>
            <Input
              id="originalUrl"
              type="url"
              required
              placeholder="https://…"
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="translatedText">{t("editor.text")}</Label>
            <Textarea
              id="translatedText"
              rows={2}
              placeholder={t("editor.textPlaceholder")}
              value={translatedText}
              onChange={(e) => setTranslatedText(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={addFrame.isPending}>
            {addFrame.isPending ? t("common.saving") : t("editor.add")}
          </Button>
          {addFrame.isError && (
            <p className="text-sm text-destructive">{(addFrame.error as Error).message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
