import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { useTikTokAccounts } from "@/features/accounts/hooks";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Un slideshow ne fait jamais plus d'une poignée de slides ; ce plafond de
// ticks est une simple sécurité anti-boucle.
const MAX_TICKS = 40;

/**
 * Teste tout le système sur un seul TikTok : scrape le post, puis fait avancer
 * le pipeline tick par tick jusqu'au bout, en montrant l'étape en cours. Ne
 * touche à aucun autre slideshow (mode ciblé côté fonction).
 */
export function TestTikTokCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: accounts } = useTikTokAccounts();

  const [url, setUrl] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [step, setStep] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [doneId, setDoneId] = React.useState<string | null>(null);

  const STEP_LABEL: Record<string, string> = {
    scraping: t("test.stepScraping"),
    scoring: t("test.stepScoring"),
    cleaning: t("test.stepCleaning"),
    translating: t("test.stepTranslating"),
    sophia: t("test.stepSophia"),
    assigning: t("test.stepAssigning"),
  };

  async function run(event: React.FormEvent) {
    event.preventDefault();
    setRunning(true);
    setError(null);
    setStep(STEP_LABEL.scraping);
    setDoneId(null);

    try {
      const { data: created, error: scrapeError } = await supabase.functions.invoke(
        "discovery",
        { body: { postUrl: url.trim(), accountId: accountId || null } },
      );
      if (scrapeError) throw scrapeError;
      const result = created as { slideshowId?: string; error?: string };
      if (!result?.slideshowId) throw new Error(result?.error ?? t("test.noSlideshow"));

      const slideshowId = result.slideshowId;

      for (let i = 0; i < MAX_TICKS; i += 1) {
        const { data: tick, error: tickError } = await supabase.functions.invoke("pipeline", {
          body: { slideshowId },
        });
        if (tickError) throw tickError;

        const t2 = tick as { step?: string; idle?: boolean };
        if (t2.step && STEP_LABEL[t2.step]) setStep(STEP_LABEL[t2.step]);

        if (t2.step === "done") {
          setDoneId(slideshowId);
          setStep(null);
          return;
        }
        if (t2.step === "rejected") {
          setError(t("test.rejected"));
          setStep(null);
          return;
        }
        if (t2.idle) break;
      }

      // Sorti de la boucle sans "done" : on ouvre quand même, l'admin verra l'état.
      setDoneId(slideshowId);
      setStep(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStep(null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" />
          {t("test.title")}
        </CardTitle>
        <CardDescription>{t("test.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={run} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="testUrl">{t("test.url")}</Label>
            <Input
              id="testUrl"
              type="url"
              required
              placeholder="https://www.tiktok.com/@.../photo/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="testAccount">{t("test.account")}</Label>
            <select
              id="testAccount"
              className={selectClass}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">{t("test.noAccount")}</option>
              {accounts?.map((account) => (
                <option key={account.id} value={account.id}>
                  @{account.handle}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" disabled={running}>
            {running ? t("test.running") : t("test.launch")}
          </Button>

          {step && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-primary" />
              {step}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {doneId && (
            <div className="flex items-center gap-3">
              <p className="text-sm text-success">{t("test.done")}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/admin/slideshows/${doneId}`)}
              >
                {t("test.seeResult")}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
