import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
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
          <ApplicationProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ApplicationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
