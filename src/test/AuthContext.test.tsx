import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

import { AuthProvider, useAuth } from "@/features/auth/AuthContext";

function Probe() {
  const { loading, user, role } = useAuth();
  if (loading) return <span>loading</span>;
  return <span>{`user:${user ? user.id : "none"} role:${role ?? "none"}`}</span>;
}

describe("AuthProvider", () => {
  it("resolves to a signed-out state when there is no session", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("user:none role:none")).toBeInTheDocument();
    });
  });
});
