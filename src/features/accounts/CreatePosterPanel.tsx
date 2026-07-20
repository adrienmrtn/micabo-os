import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { accountKeys } from "./hooks";

function randomPassword() {
  // Mot de passe lisible que l'admin transmet au créateur ; il pourra le changer.
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

export function CreatePosterPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [password, setPassword] = React.useState(randomPassword());
  const [created, setCreated] = React.useState<{ email: string; password: string } | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "create", email, password, displayName },
      });
      if (error) throw error;
      const result = data as { error?: string };
      if (result?.error) throw new Error(result.error);
    },
    onSuccess: () => {
      setCreated({ email, password });
      queryClient.invalidateQueries({ queryKey: accountKeys.users });
      queryClient.invalidateQueries({ queryKey: accountKeys.posters });
      setEmail("");
      setDisplayName("");
      setPassword(randomPassword());
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-4" />
          {t("creators.title")}
        </CardTitle>
        <CardDescription>{t("creators.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCreated(null);
            create.mutate();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label htmlFor="cEmail">{t("creators.email")}</Label>
            <Input
              id="cEmail"
              type="email"
              required
              placeholder="creator@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cName">{t("creators.displayName")}</Label>
            <Input
              id="cName"
              placeholder="Alex"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cPass">{t("creators.password")}</Label>
            <div className="flex gap-2">
              <Input
                id="cPass"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setPassword(randomPassword())}
              >
                {t("creators.regenerate")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("creators.passwordHint")}</p>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t("common.saving") : t("creators.create")}
            </Button>
            {create.isError && (
              <p className="mt-2 text-sm text-destructive">{(create.error as Error).message}</p>
            )}
          </div>
        </form>

        {created && (
          <div className="space-y-1 rounded-lg border border-success/40 bg-success/5 p-4">
            <p className="text-sm font-medium text-success">{t("creators.done")}</p>
            <p className="text-sm">
              <span className="text-muted-foreground">{t("creators.email")} : </span>
              {created.email}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">{t("creators.password")} : </span>
              <code className="rounded bg-muted px-1">{created.password}</code>
            </p>
            <p className="pt-1 text-xs text-muted-foreground">{t("creators.transmit")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
