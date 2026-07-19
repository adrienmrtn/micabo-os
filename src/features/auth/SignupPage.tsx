import * as React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpWithPassword } from "./api";
import { AuthLayout } from "./AuthLayout";

export function SignupPage() {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data, error: signUpError } = await signUpWithPassword(
      email,
      password,
      displayName,
    );

    setSubmitting(false);

    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes("already")
          ? t("auth.errorEmailTaken")
          : signUpError.message,
      );
      return;
    }

    // La confirmation par email est désactivée : signUp renvoie donc une
    // session et la redirection se fait toute seule. Ce cas ne sert que si
    // elle est réactivée un jour côté Supabase.
    if (!data.session) setConfirmationSent(true);
  }

  if (confirmationSent) {
    return (
      <AuthLayout title={t("auth.checkInboxTitle")} description={t("auth.checkInboxBody", { email })}>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <MailCheck className="size-5" />
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">{t("auth.backToLogin")}</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.signupTitle")}
      description={t("auth.signupSubtitle")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t("auth.submit")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">{t("auth.displayName")}</Label>
          <Input
            id="displayName"
            autoComplete="nickname"
            placeholder="Alex"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

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
            autoComplete="new-password"
            placeholder="••••••••"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? t("auth.signupSubmitting") : t("auth.signupSubmit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
