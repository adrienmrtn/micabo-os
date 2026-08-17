import { describe, expect, it } from "vitest";

import { badgeManager, estRoleManager } from "./roles";

describe("estRoleManager", () => {
  it("couvre HM et DM, pas admin ni poster", () => {
    expect(estRoleManager("hiring_manager")).toBe(true);
    expect(estRoleManager("directing_manager")).toBe(true);
    expect(estRoleManager("admin")).toBe(false);
    expect(estRoleManager("poster")).toBe(false);
    expect(estRoleManager(null)).toBe(false);
  });
});

describe("badgeManager", () => {
  it("affiche HM ou DM", () => {
    expect(badgeManager("hiring_manager")).toBe("HM");
    expect(badgeManager("directing_manager")).toBe("DM");
    expect(badgeManager("admin")).toBeNull();
  });
});
