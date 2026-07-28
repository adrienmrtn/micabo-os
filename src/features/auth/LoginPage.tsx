import * as React from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Briefcase, ShieldCheck, Users, type LucideIcon } from "lucide-react";

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
  }

  return (
    <div className="surface-atelier flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {!choisi ? (
        <div className="w-full max-w-2xl animate-brand-in text-center">
          <p className="font-display text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            Sophia
          </p>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">{t("auth.tagline")}</p>

          <div className="mx-auto mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
            {CARDS.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => {
                  setError(null);
                  setChoisi(card);
                }}
                className={cn(
                  "group flex flex-col items-center gap-2 border border-border/70 bg-card/70 px-4 py-5 text-center transition-all duration-200",
                  "hover:border-primary/40 hover:bg-card",
                )}
              >
                <card.icon className="size-5 text-primary transition-transform group-hover:scale-105" />
                <span className="text-sm font-semibold tracking-tight">{t(card.labelKey)}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {t(card.descKey)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 text-center">
            <p className="font-display text-3xl font-semibold tracking-tight">Sophia</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.tagline")}</p>
          </div>

          <div className="border border-border/80 bg-card/90 p-6 shadow-lifted">
            <button
              type="button"
              onClick={() => setChoisi(null)}
              className="mb-5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              {t("auth.changeAccess")}
            </button>

            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <choisi.icon className="size-4" />
              </span>
              <div>
                <h1 className="text-base font-semibold tracking-tight">{t(choisi.labelKey)}</h1>
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? t("auth.submitting") : t("auth.submit")}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
