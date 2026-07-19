import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter } from "react-router-dom";

import { AuthProvider } from "@/features/auth/AuthContext";
import "@/locales";

const queryClient = new QueryClient();

/**
 * Le Storage Supabase sert des fichiers, pas une application : il ne sait pas
 * réécrire /dashboard vers index.html. Les routes en `#` restent donc du
 * ressort du navigateur et fonctionnent partout. Sur un hébergeur capable de
 * réécriture (Vercel & co), on repasse en URLs propres via VITE_ROUTER.
 */
const Router = import.meta.env.VITE_ROUTER === "hash" ? HashRouter : BrowserRouter;

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>{children}</AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}
