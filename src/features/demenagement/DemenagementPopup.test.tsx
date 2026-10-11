import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@/locales";

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ user: { email: "omerc@micabo.app" }, profil: { langues: ["fr", "tr"], email: "omerc@micabo.app" } }),
}));

import { DemenagementPopup } from "./DemenagementPopup";

describe("DemenagementPopup", () => {
  it("affiche, dans la langue du créateur, le nouvel OS et ses identifiants Sophia", () => {
    render(<DemenagementPopup identifiant="omerc@sophia.com" />);
    expect(screen.getByText("micabo OS taşındı")).toBeTruthy();
    expect(screen.getByText("omerc@sophia.com")).toBeTruthy();
    expect(screen.getByText("12345678")).toBeTruthy();
    const liens = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(liens).toContain("https://sophia-marketing-orga.vercel.app/login");
  });

  it("« Fermer » le masque jusqu'au prochain chargement", () => {
    render(<DemenagementPopup identifiant="omerc@sophia.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Kapat" }));
    expect(screen.queryByText("micabo OS taşındı")).toBeNull();
  });
});
