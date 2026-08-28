import type * as React from "react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";

/** Cadre commun aux écrans auth secondaires (changement MDP…). */
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
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 text-center animate-brand-in">
        <span className="brand-mark mx-auto" aria-hidden>
          m
        </span>
        <p className="font-heading mt-4 text-3xl font-semibold tracking-tight">micabo</p>
      </div>

      <Card className="w-full max-w-sm animate-fade-in">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardPanel>{children}</CardPanel>
      </Card>

      {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
