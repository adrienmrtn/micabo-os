import * as React from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Briefcase, ShieldCheck, Sparkles, Users, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { signInWithPassword } from "./api";

type AccessKey = "admin" | "manager" | "creator";

interface AccessCard {
  key: AccessKey;
  icon: LucideIcon;
  labelKey: string;
  descKey: string;
}

const CARDS: AccessCard[] = [
  { key: "admin", icon: ShieldCheck, labelKey: "auth.accessAdmin", descKey: "auth.accessAdminDesc" },
  { key: "manager", icon: Briefcase, labelKey: "auth.accessManager", descKey: "auth.accessManagerDesc" },
  { key: "creator", icon: Users, labelKey: "auth.accessCreator", descKey: "auth.accessCreatorDesc" },
];

export function LoginPage() {
  const { t } = useTranslation();
  const [choisi, setChoisi] = React.useState<AccessCard | null>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await signInWithPassword(email, password);

    setSubmitting(false);
    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes("invalid")
          ? t("auth.errorInvalidCredentials")
          : t("auth.errorGeneric"),
      );
    }
    // Succès : AuthContext capte la session et redirige selon le VRAI rôle du
    // compte (le choix de carte n'est qu'un point d'entrée visuel).
  }

  return (
    <div className="surface-gradient flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-9 flex items-center gap-2.5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-sidebar-active shadow-sm">
          <Sparkles className="size-5 text-white" />
        </div>
        <span className="text-lg font-semibold tracking-tight">{t("app.name")}</span>
      </div>

      {!choisi ? (
        <div className="w-full max-w-3xl animate-fade-in text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t("auth.welcome")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("auth.chooseAccess")}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {CARDS.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => {
                  setError(null);
                  setChoisi(card);
                }}
                className={cn(
                  "group flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center shadow-card transition-all",
                  "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lifted",
                )}
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <card.icon className="size-6" />
                </span>
                <span className="text-base font-semibold">{t(card.labelKey)}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {t(card.descKey)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-sm animate-fade-in rounded-2xl border bg-card p-6 shadow-lifted">
          <button
            type="button"
            onClick={() => setChoisi(null)}
            className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {t("auth.changeAccess")}
          </button>

          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <choisi.icon className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{t(choisi.labelKey)}</h1>
              <p className="text-xs text-muted-foreground">{t("auth.loginSubtitle")}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="toi@exemple.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? t("auth.submitting") : t("auth.submit")}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
