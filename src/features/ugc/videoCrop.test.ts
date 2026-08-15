import { describe, expect, it } from "vitest";

import { estCheminTmpFull, extraireOffsetFrame, normaliserTrim, trimPlein, estTrimPlein } from "./videoCrop";

describe("videoCrop trim", () => {
  it("trimPlein couvre toute la durée", () => {
    expect(trimPlein(8.2)).toEqual({ startSec: 0, endSec: 8.2 });
  });

  it("estTrimPlein accepte une coupe quasi intégrale", () => {
    expect(estTrimPlein(0, 8.2, 8.2)).toBe(true);
    expect(estTrimPlein(0, 8.2, 8.15)).toBe(true);
    expect(estTrimPlein(0.04, 8.2, 8.2)).toBe(true);
  });

  it("estTrimPlein refuse un vrai crop", () => {
    expect(estTrimPlein(1.2, 8.2, 8.2)).toBe(false);
    expect(estTrimPlein(0, 6, 8.2)).toBe(false);
    expect(estTrimPlein(0, 8, null)).toBe(false);
  });

  it("repère _tmp_full vs vidéo déjà cropée", () => {
    expect(estCheminTmpFull("ugc/reactions/abc/_tmp_full.mp4")).toBe(true);
    expect(estCheminTmpFull("ugc/reactions/abc/video.mp4")).toBe(false);
    expect(estCheminTmpFull(null)).toBe(false);
  });

  it("normaliserTrim borne dans la durée", () => {
    expect(normaliserTrim({ startSec: -1, endSec: 99 }, 5)).toEqual({
      startSec: 0,
      endSec: 5,
    });
  });
});

describe("offset 10e frame", () => {
  it("frame 10 à 30 fps = 0.3 s", () => {
    expect(extraireOffsetFrame(10, 30)).toBeCloseTo(0.3);
  });
});
