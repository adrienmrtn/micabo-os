import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { slideshowKeys } from "./hooks";

type FunctionName = "discovery" | "pipeline";

/**
 * Déclenche manuellement les Edge Functions. L'appel porte le JWT de l'admin :
 * la fonction revérifie le rôle côté serveur, donc aucun secret ne descend
 * dans le navigateur.
 */
async function invoke(name: FunctionName) {
  const { data, error } = await supabase.functions.invoke(name, { body: {} });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export function PipelineControlPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [running, setRunning] = React.useState<FunctionName | null>(null);
  const [result, setResult] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(name: FunctionName) {
    setRunning(name);
    setResult(null);
    setError(null);

    try {
      const data = await invoke(name);
      setResult(JSON.stringify(data));
      queryClient.invalidateQueries({ queryKey: slideshowKeys.all });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunning(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pipelineControl.title")}</CardTitle>
        <CardDescription>{t("pipelineControl.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={running !== null}
            onClick={() => run("discovery")}
          >
            {running === "discovery"
              ? t("pipelineControl.running")
              : t("pipelineControl.runDiscovery")}
          </Button>
          <Button
            variant="outline"
            disabled={running !== null}
            onClick={() => run("pipeline")}
          >
            {running === "pipeline"
              ? t("pipelineControl.running")
              : t("pipelineControl.runPipeline")}
          </Button>
        </div>

        {result && (
          <p className="break-all rounded-md bg-muted p-2 font-mono text-xs">{result}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <p className="text-xs text-muted-foreground">{t("pipelineControl.costWarning")}</p>
      </CardContent>
    </Card>
  );
}
