import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ImagePlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useTikTokAccounts } from "./hooks";

const BUCKET = "slideshow-media";

interface AccountImage {
  id: string;
  tiktok_account_id: string | null;
  public_url: string;
  storage_path: string;
  kind: "slide_background" | "profile_photo";
  source: "upload" | "cleaned_slide";
  used_count: number;
}

async function listImages(accountId: string): Promise<AccountImage[]> {
  const { data, error } = await supabase
    .from("account_images")
    .select("*")
    .eq("tiktok_account_id", accountId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AccountImage[];
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function ImageLibraryPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: accounts } = useTikTokAccounts();

  const [accountId, setAccountId] = React.useState("");
  const [kind, setKind] = React.useState<AccountImage["kind"]>("slide_background");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { data: images, isPending } = useQuery({
    queryKey: ["account-images", accountId],
    queryFn: () => listImages(accountId),
    enabled: Boolean(accountId),
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const extension = file.name.split(".").pop() ?? "jpg";
        const path = `library/${accountId}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file);
        if (uploadError) throw uploadError;

        const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

        const { error } = await supabase.from("account_images").insert({
          tiktok_account_id: accountId,
          storage_path: path,
          public_url: publicUrl,
          kind,
          source: "upload",
          created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-images", accountId] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const remove = useMutation({
    mutationFn: async (image: AccountImage) => {
      await supabase.storage.from(BUCKET).remove([image.storage_path]);
      const { error } = await supabase.from("account_images").delete().eq("id", image.id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["account-images", accountId] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("library.title")}</CardTitle>
        <CardDescription>{t("library.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="libAccount">{t("library.account")}</Label>
            <select
              id="libAccount"
              className={selectClass}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">{t("library.selectAccount")}</option>
              {accounts?.map((account) => (
                <option key={account.id} value={account.id}>
                  @{account.handle}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="libKind">{t("library.kind")}</Label>
            <select
              id="libKind"
              className={selectClass}
              value={kind}
              onChange={(e) => setKind(e.target.value as AccountImage["kind"])}
            >
              <option value="slide_background">{t("library.kindBackground")}</option>
              <option value="profile_photo">{t("library.kindProfile")}</option>
            </select>
          </div>
        </div>

        {accountId && (
          <>
            <div className="space-y-2">
              <Label htmlFor="libFiles">{t("library.addImages")}</Label>
              <Input
                id="libFiles"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={upload.isPending}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) upload.mutate(files);
                }}
              />
              {upload.isPending && (
                <p className="text-xs text-muted-foreground">{t("library.uploading")}</p>
              )}
              {upload.isError && (
                <p className="text-sm text-destructive">
                  {(upload.error as Error).message}
                </p>
              )}
            </div>

            {isPending && (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            )}

            {images && images.length === 0 && (
              <EmptyState
                icon={<ImagePlus className="size-5" />}
                title={t("library.emptyTitle")}
                description={t("library.emptyBody")}
              />
            )}

            {images && images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((image) => (
                  <div key={image.id} className="space-y-1.5">
                    <img
                      src={image.public_url}
                      alt=""
                      className="aspect-[3/4] w-full rounded-md border object-cover"
                    />
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={image.source === "upload" ? "secondary" : "outline"}>
                        {image.source === "upload"
                          ? t("library.sourceUpload")
                          : t("library.sourceCleaned")}
                      </Badge>
                      {image.used_count > 0 && (
                        <Badge variant="outline">
                          {t("library.used", { count: image.used_count })}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full"
                      onClick={() => remove.mutate(image)}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
