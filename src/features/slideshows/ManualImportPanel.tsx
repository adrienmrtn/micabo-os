import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePosters, useTikTokAccounts } from "@/features/accounts/hooks";
import { useCreateManualSlideshow } from "./hooks";
import { today } from "./api";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Import manuel : permet de produire un slideshow sans attendre le pipeline
 * automatique. Le contenu est considéré prêt (statut `done`), l'admin ajoute
 * ensuite les slides depuis l'éditeur.
 */
export function ManualImportPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: accounts } = useTikTokAccounts();
  const { data: posters } = usePosters();
  const createSlideshow = useCreateManualSlideshow();

  const [sourceUrl, setSourceUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [hookTitle, setHookTitle] = React.useState("");
  const [tiktokAccountId, setTiktokAccountId] = React.useState("");
  const [posterId, setPosterId] = React.useState("");
  const [assignedDate, setAssignedDate] = React.useState(today());

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const slideshow = await createSlideshow.mutateAsync({
      tiktokAccountId: tiktokAccountId || null,
      posterId: posterId || null,
      sourceUrl,
      title,
      hookTitle,
      assignedDate: posterId ? assignedDate : null,
    });

    navigate(`/admin/slideshows/${slideshow.id}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("manual.title")}</CardTitle>
        <CardDescription>{t("manual.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sourceUrl">{t("manual.sourceUrl")}</Label>
            <Input
              id="sourceUrl"
              type="url"
              placeholder="https://www.tiktok.com/@.../photo/..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">{t("manual.slideshowTitle")}</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hookTitle">{t("manual.hookTitle")}</Label>
            <Input
              id="hookTitle"
              placeholder={t("manual.hookPlaceholder")}
              value={hookTitle}
              onChange={(e) => setHookTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account">{t("manual.referenceAccount")}</Label>
            <select
              id="account"
              className={selectClass}
              value={tiktokAccountId}
              onChange={(e) => setTiktokAccountId(e.target.value)}
            >
              <option value="">{t("manual.noAccount")}</option>
              {accounts?.map((account) => (
                <option key={account.id} value={account.id}>
                  @{account.handle}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="poster">{t("manual.assignTo")}</Label>
            <select
              id="poster"
              className={selectClass}
              value={posterId}
              onChange={(e) => setPosterId(e.target.value)}
            >
              <option value="">{t("manual.unassigned")}</option>
              {posters?.map((poster) => (
                <option key={poster.id} value={poster.id}>
                  {poster.display_name ?? poster.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>

          {posterId && (
            <div className="space-y-2">
              <Label htmlFor="assignedDate">{t("manual.assignedDate")}</Label>
              <Input
                id="assignedDate"
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={createSlideshow.isPending}>
              {createSlideshow.isPending ? t("common.saving") : t("manual.create")}
            </Button>
            {createSlideshow.isError && (
              <p className="mt-2 text-sm text-destructive">
                {(createSlideshow.error as Error).message}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
