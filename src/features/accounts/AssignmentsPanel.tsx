import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/AuthContext";
import { MAX_ACCOUNTS_PER_POSTER } from "./api";
import {
  useAssignments,
  useCreateAssignment,
  useDeleteAssignment,
  usePosters,
  useTikTokAccounts,
} from "./hooks";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function AssignmentsPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: assignments, isPending } = useAssignments();
  const { data: posters } = usePosters();
  const { data: accounts } = useTikTokAccounts();
  const createAssignment = useCreateAssignment(user?.id);
  const deleteAssignment = useDeleteAssignment();

  const [posterId, setPosterId] = React.useState("");
  const [tiktokAccountId, setTiktokAccountId] = React.useState("");

  const countByPoster = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const assignment of assignments ?? []) {
      counts.set(assignment.poster_id, (counts.get(assignment.poster_id) ?? 0) + 1);
    }
    return counts;
  }, [assignments]);

  const activeAccounts = (accounts ?? []).filter((account) => account.is_active);
  const isPosterFull =
    posterId !== "" && (countByPoster.get(posterId) ?? 0) >= MAX_ACCOUNTS_PER_POSTER;

  async function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!posterId || !tiktokAccountId) return;
    await createAssignment.mutateAsync({ posterId, tiktokAccountId });
    setTiktokAccountId("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("assignments.title")}</CardTitle>
        <CardDescription>
          {t("assignments.subtitle", { max: MAX_ACCOUNTS_PER_POSTER })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleAssign} className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="poster">{t("assignments.poster")}</Label>
            <select
              id="poster"
              className={selectClass}
              value={posterId}
              onChange={(e) => setPosterId(e.target.value)}
              required
            >
              <option value="">{t("assignments.selectPoster")}</option>
              {posters?.map((poster) => (
                <option key={poster.id} value={poster.id}>
                  {poster.display_name ?? poster.id.slice(0, 8)} (
                  {countByPoster.get(poster.id) ?? 0}/{MAX_ACCOUNTS_PER_POSTER})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account">{t("assignments.account")}</Label>
            <select
              id="account"
              className={selectClass}
              value={tiktokAccountId}
              onChange={(e) => setTiktokAccountId(e.target.value)}
              required
            >
              <option value="">{t("assignments.selectAccount")}</option>
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  @{account.handle}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              className="w-full"
              disabled={createAssignment.isPending || isPosterFull}
            >
              {t("assignments.assign")}
            </Button>
          </div>

          {isPosterFull && (
            <p className="text-sm text-amber-600 sm:col-span-3">
              {t("assignments.limitReached", { max: MAX_ACCOUNTS_PER_POSTER })}
            </p>
          )}
          {createAssignment.isError && (
            <p className="text-sm text-destructive sm:col-span-3">
              {(createAssignment.error as Error).message}
            </p>
          )}
        </form>

        <div className="space-y-2">
          {isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          {posters?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("assignments.noPosters")}</p>
          )}
          {assignments?.length === 0 && posters && posters.length > 0 && (
            <p className="text-sm text-muted-foreground">{t("assignments.empty")}</p>
          )}

          {assignments?.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{assignment.profiles?.display_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  @{assignment.tiktok_accounts?.handle ?? "—"}
                  {assignment.tiktok_accounts?.niche
                    ? ` · ${assignment.tiktok_accounts.niche}`
                    : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => deleteAssignment.mutate(assignment.id)}
              >
                {t("assignments.unassign")}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
