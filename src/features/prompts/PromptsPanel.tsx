import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";

interface Prompt {
  key: string;
  content: string;
  updated_at: string;
}

interface Correction {
  id: string;
  original_text: string | null;
  corrected_text: string;
  created_at: string;
}

async function fetchPrompt(key: string): Promise<Prompt | null> {
  const { data } = await supabase.from("sophia_prompts").select("*").eq("key", key).single();
  return (data as Prompt) ?? null;
}

async function fetchCorrections(): Promise<Correction[]> {
  const { data } = await supabase
    .from("sophia_corrections")
    .select("id, original_text, corrected_text, created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  return (data ?? []) as Correction[];
}

export function PromptsPanel() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: prompt, isPending } = useQuery({
    queryKey: ["sophia-prompt", "master"],
    queryFn: () => fetchPrompt("master"),
  });
  const { data: corrections } = useQuery({
    queryKey: ["sophia-corrections"],
    queryFn: fetchCorrections,
  });

  const [content, setContent] = React.useState("");
  const [initialised, setInitialised] = React.useState(false);

  React.useEffect(() => {
    if (prompt && !initialised) {
      setContent(prompt.content);
      setInitialised(true);
    }
  }, [prompt, initialised]);

  const save = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("sophia_prompts")
        .update({ content: value, updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq("key", "master");
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["sophia-prompt", "master"] }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("prompts.title")}</CardTitle>
          <CardDescription>{t("prompts.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isPending ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : (
            <>
              <Textarea
                rows={14}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-xs"
              />
              <Button
                disabled={save.isPending || content === prompt?.content}
                onClick={() => save.mutate(content)}
              >
                {save.isPending ? t("common.saving") : t("common.save")}
              </Button>
              {save.isError && (
                <p className="text-sm text-destructive">{(save.error as Error).message}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
                <p className="text-muted-foreground line-through">
                  {correction.original_text}
                </p>
              )}
              <p>{correction.corrected_text}</p>
              <p className="pt-1 text-xs text-muted-foreground">
                {new Date(correction.created_at).toLocaleString(i18n.language)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
