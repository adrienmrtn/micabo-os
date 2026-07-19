import type * as React from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

/** Cadre commun aux écrans de connexion et d'inscription. */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="surface-gradient flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
          <Sparkles className="size-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold tracking-tight">{t("app.name")}</span>
      </div>

      <div className="w-full max-w-sm animate-fade-in rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-6 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>

      {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
