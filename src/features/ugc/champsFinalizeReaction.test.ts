import { describe, expect, it } from "vitest";

import { champsFinalizeReaction } from "./champsFinalizeReaction";

describe("champsFinalizeReaction", () => {
  it("envoie crop + videoPath/videoUrl de la source _tmp_full", () => {
    expect(
      champsFinalizeReaction({
        id: "r1",
        titre: "Wow",
        crop: { startSec: 1.2, endSec: 6.5 },
        videoSourcePath: "ugc/reactions/r1/_tmp_full.mp4",
        videoSourceUrl: "https://cdn.example/_tmp_full.mp4",
        firstFramePath: "ugc/reactions/r1/first_frame_reference.jpg",
        firstFrameUrl: "https://cdn.example/f.jpg",
        dureeMs: 5300,
        labelId: "lab",
      }),
    ).toEqual({
      id: "r1",
      titre: "Wow",
      crop: { startSec: 1.2, endSec: 6.5 },
      videoPath: "ugc/reactions/r1/_tmp_full.mp4",
      videoUrl: "https://cdn.example/_tmp_full.mp4",
      firstFramePath: "ugc/reactions/r1/first_frame_reference.jpg",
      firstFrameUrl: "https://cdn.example/f.jpg",
      dureeMs: 5300,
      labelId: "lab",
    });
  });

  it("n’envoie pas videoPath vide (mais garde le crop)", () => {
    const body = champsFinalizeReaction({
      id: "r2",
      crop: { startSec: 0, endSec: 3 },
      videoSourcePath: "  ",
      videoSourceUrl: null,
      firstFramePath: "f.jpg",
      firstFrameUrl: "https://x/f.jpg",
      labelId: "lab",
    });
    expect(body.videoPath).toBeUndefined();
    expect(body.videoUrl).toBeUndefined();
    expect(body.crop).toEqual({ startSec: 0, endSec: 3 });
  });
});
