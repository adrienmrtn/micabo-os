import * as React from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import {
  useCreateTikTokAccount,
  useDeleteTikTokAccount,
  useTikTokAccounts,
  useUpdateTikTokAccount,
} from "./hooks";

/**
 * Essai ciblé : lance la discovery sur ce seul compte, sans attendre le cron
 * ni payer un scan de tous les comptes. Fonctionne même si le compte est
 * inactif, ce qui permet de valider un compte avant de l'activer.
 */
function TestAccountButton({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  const [state, setState] = React.useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  async function run() {
    setState("running");
    setMessage(null);

    const { data, error } = await supabase.functions.invoke("discovery", {
      body: { accountId },
    });

    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }

    setState("done");
    const result = data as { scanned?: number; created?: number };
    setMessage(t("accounts.testResult", { count: result?.created ?? 0 }));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={state === "running"} onClick={run}>
        {state === "running" ? t("accounts.testing") : t("accounts.test")}
      </Button>
      {message && (
        <span
          className={
            state === "error"
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {message}
        </span>
      )}
    </div>
  );
}

export function TikTokAccountsPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: accounts, isPending, isError, error } = useTikTokAccounts();
  const createAccount = useCreateTikTokAccount(user?.id);
  const updateAccount = useUpdateTikTokAccount();
  const deleteAccount = useDeleteTikTokAccount();

  const [handle, setHandle] = React.useState("");
  const [niche, setNiche] = React.useState("");
  const [suggestedCreatorHandle, setSuggestedCreatorHandle] = React.useState("");
  const [profileUrl, setProfileUrl] = React.useState("");
  const [notes, setNotes] = React.useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!handle.trim()) return;

    await createAccount.mutateAsync({
      handle,
      niche,
      suggestedCreatorHandle,
      profileUrl,
      notes,
    });
    setHandle("");
    setNiche("");
    setSuggestedCreatorHandle("");
    setProfileUrl("");
    setNotes("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("accounts.title")}</CardTitle>
        <CardDescription>{t("accounts.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="handle">{t("accounts.handle")}</Label>
            <Input
              id="handle"
              placeholder="@mon_compte_source"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="niche">{t("accounts.niche")}</Label>
            <Input
              id="niche"
              placeholder={t("accounts.nichePlaceholder")}
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="suggested">{t("accounts.suggestedHandle")}</Label>
            <Input
              id="suggested"
              placeholder="sophia.mindset"
              value={suggestedCreatorHandle}
              onChange={(e) => setSuggestedCreatorHandle(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("accounts.suggestedHandleHint")}
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">{t("accounts.notes")}</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={createAccount.isPending}>
              {createAccount.isPending ? t("common.saving") : t("accounts.add")}
            </Button>
            {createAccount.isError && (
              <p className="mt-2 text-sm text-destructive">
                {(createAccount.error as Error).message}
              </p>
            )}
          </div>
        </form>

        <div className="space-y-2">
          {isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          {isError && <p className="text-sm text-destructive">{(error as Error).message}</p>}
          {accounts?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("accounts.empty")}</p>
          )}

          {accounts?.map((account) => (
            <div
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">@{account.handle}</span>
                  {!account.is_active && (
                    <Badge variant="secondary">{t("accounts.inactive")}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {[account.niche, account.suggested_creator_handle]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <TestAccountButton accountId={account.id} />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateAccount.mutate({
                      id: account.id,
                      patch: { is_active: !account.is_active },
                    })
                  }
                >
                  {account.is_active ? t("accounts.deactivate") : t("accounts.activate")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm(t("accounts.confirmDelete")))
                      deleteAccount.mutate(account.id);
                  }}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </div>
          ))}
          {deleteAccount.isError && (
            <p className="text-sm text-destructive">
              {(deleteAccount.error as Error).message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
