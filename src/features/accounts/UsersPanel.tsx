import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/AuthContext";
import { useSetUserActive, useSetUserRole, useUsers } from "./hooks";

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function UsersPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: users, isPending, isError, error } = useUsers();
  const setRole = useSetUserRole();
  const setActive = useSetUserActive();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("users.title")}</CardTitle>
        <CardDescription>{t("users.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
        {isError && <p className="text-sm text-destructive">{(error as Error).message}</p>}

        {users?.map((managedUser) => {
          const isSelf = managedUser.id === user?.id;
          return (
            <div
              key={managedUser.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {managedUser.display_name ?? managedUser.id.slice(0, 8)}
                  </span>
                  {isSelf && <Badge variant="outline">{t("users.you")}</Badge>}
                  {!managedUser.is_active && (
                    <Badge variant="secondary">{t("users.disabled")}</Badge>
                  )}
                  {managedUser.role === "poster" && managedUser.account_setup_done && (
                    <Badge variant="success">{t("users.setupDone")}</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  className={selectClass}
                  value={managedUser.role ?? "poster"}
                  // Se retirer soi-même le rôle admin couperait l'accès en pleine session.
                  disabled={isSelf || setRole.isPending}
                  onChange={(e) =>
                    setRole.mutate({
                      userId: managedUser.id,
                      role: e.target.value as "admin" | "poster",
                    })
                  }
                >
                  <option value="admin">{t("users.role.admin")}</option>
                  <option value="poster">{t("users.role.poster")}</option>
                </select>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSelf || setActive.isPending}
                  onClick={() =>
                    setActive.mutate({
                      userId: managedUser.id,
                      isActive: !managedUser.is_active,
                    })
                  }
                >
                  {managedUser.is_active ? t("users.disable") : t("users.enable")}
                </Button>
              </div>
            </div>
          );
        })}

        {(setRole.isError || setActive.isError) && (
          <p className="text-sm text-destructive">
            {((setRole.error ?? setActive.error) as Error).message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
