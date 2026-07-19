import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";

const WARMUP_STEPS = ["scroll", "follow", "like", "wait"] as const;

interface PosterAccount {
  assignment_id: string;
  poster_id: string;
  suggested_creator_handle: string | null;
  niche: string | null;
}

/** Lit `poster_accounts`, qui n'expose jamais le compte de référence. */
async function fetchMyAccounts(posterId: string): Promise<PosterAccount[]> {
  const { data } = await supabase
    .from("poster_accounts")
    .select("*")
    .eq("poster_id", posterId)
    .order("assigned_at");

  return (data ?? []) as PosterAccount[];
}

export function AccountSetupCard() {
  const { t } = useTranslation();
  const { user, profile, refresh } = useAuth();
  const queryClient = useQueryClient();

  const { data: accounts } = useQuery({
    queryKey: ["poster-accounts", user?.id],
    queryFn: () => fetchMyAccounts(user!.id),
    enabled: Boolean(user?.id),
  });

  const markDone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ account_setup_done: true })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poster-accounts"] });
      refresh();
    },
  });

  // Une fois l'onboarding validé, la carte disparaît définitivement.
  if (!profile || profile.account_setup_done) return null;
  if (!accounts || accounts.length === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle>{t("setup.title")}</CardTitle>
        <CardDescription>{t("setup.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          {accounts.map((account) => (
            <div key={account.assignment_id} className="rounded-lg border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("setup.handleToCreate")}
              </p>
              <p className="text-lg font-semibold">
                {account.suggested_creator_handle ?? t("setup.handleComingSoon")}
              </p>
              {account.niche && (
                <Badge variant="secondary" className="mt-2">
                  {account.niche}
                </Badge>
              )}
            </div>
          ))}
        </div>

        <div>
          <p className="mb-2 font-medium">{t("setup.warmupTitle")}</p>
          <ul className="space-y-1.5">
            {WARMUP_STEPS.map((step) => (
              <li key={step} className="flex gap-2 text-sm text-muted-foreground">
                <span aria-hidden>•</span>
                <span>{t(`setup.warmup.${step}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <Button disabled={markDone.isPending} onClick={() => markDone.mutate()}>
          {markDone.isPending ? t("common.saving") : t("setup.done")}
        </Button>
        {markDone.isError && (
          <p className="text-sm text-destructive">{(markDone.error as Error).message}</p>
        )}
      </CardContent>
    </Card>
  );
}
