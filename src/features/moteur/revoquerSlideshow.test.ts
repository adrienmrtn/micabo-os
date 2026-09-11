import { describe, expect, it } from "vitest";

import { doitRejeterSlideshow } from "./revoquerSlideshow";

describe("doitRejeterSlideshow", () => {
  it("un recharge créateur laisse le slideshow dans le pool", () => {
    expect(doitRejeterSlideshow("poster")).toBe(false);
  });

  it("un changement admin sort le slideshow du pool", () => {
    expect(doitRejeterSlideshow("admin")).toBe(true);
  });
});
