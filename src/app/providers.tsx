import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "@/features/auth/AuthContext";
import { ApplicationProvider } from "@/features/moteur/ApplicationContext";
import "@/locales";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ApplicationProvider>{children}</ApplicationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
