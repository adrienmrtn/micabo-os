import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";

interface Correction {
  id: string;
  original_text: string | null;
  corrected_text: string;
  created_at: string;
}

/** Les trois prompts pilotant le pipeline, éditables sans redéploiement. */
const EDITABLE_PROMPTS = [
  { key: "relevance", titleKey: "prompts.relevanceTitle", descKey: "prompts.relevanceDesc" },
  { key: "master", titleKey: "prompts.masterTitle", descKey: "prompts.masterDesc" },
  { key: "translate", titleKey: "prompts.translateTitle", descKey: "prompts.translateDesc" },
] as const;

async function fetchPromptContent(key: string): Promise<string> {
  const { data } = await supabase
    .from("sophia_prompts")
    .select("content")
    .eq("key", key)
    .maybeSingle();
  return data?.content ?? "";
}

function PromptEditor({
  promptKey,
  title,
  description,
}: {
  promptKey: string;
  title: string;
  description: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: initial, isPending } = useQuery({
    queryKey: ["sophia-prompt", promptKey],
    queryFn: () => fetchPromptContent(promptKey),
  });

  const [content, setContent] = React.useState<string | null>(null);
  const value = content ?? initial ?? "";

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("sophia_prompts")
        .upsert(
          { key: promptKey, content: value, updated_by: user?.id, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sophia-prompt", promptKey] }),
  });

  const dirty = content !== null && content !== (initial ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <>
            <Textarea
              rows={12}
              value={value}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="flex items-center gap-3">
              <Button disabled={save.isPending || !dirty} onClick={() => save.mutate()}>
                {save.isPending ? t("common.saving") : t("common.save")}
              </Button>
              {save.isSuccess && !dirty && (
                <span className="text-sm text-success">{t("prompts.saved")}</span>
              )}
            </div>
            {save.isError && (
              <p className="text-sm text-destructive">{(save.error as Error).message}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CorrectionsCard() {
  const { t, i18n } = useTranslation();
  const { data: corrections } = useQuery({
    queryKey: ["sophia-corrections"],
    queryFn: async (): Promise<Correction[]> => {
      const { data } = await supabase
        .from("sophia_corrections")
        .select("id, original_text, corrected_text, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      return (data ?? []) as Correction[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("prompts.correctionsTitle")}</CardTitle>
        <CardDescription>{t("prompts.correctionsSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {corrections?.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("prompts.noCorrections")}</p>
        )}
        {corrections?.map((correction) => (
          <div key={correction.id} className="rounded-lg border p-3 text-sm">
            {correction.original_text && (
              <p className="text-muted-foreground line-through">{correction.original_text}</p>
            )}
            <p>{correction.corrected_text}</p>
            <p className="pt-1 text-xs text-muted-foreground">
              {new Date(correction.created_at).toLocaleString(i18n.language)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PromptsPanel() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      {EDITABLE_PROMPTS.map((prompt) => (
        <PromptEditor
          key={prompt.key}
          promptKey={prompt.key}
          title={t(prompt.titleKey)}
          description={t(prompt.descKey)}
        />
      ))}
      <CorrectionsCard />
    </div>
  );
}
