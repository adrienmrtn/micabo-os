import { describe, expect, it } from "vitest";

import { pickTikTokVideoUrl } from "./pickTikTokVideoUrl";

describe("pickTikTokVideoUrl", () => {
  it("prend le dernier MP4 de mediaUrls (fichier KV Apify, pas un recodage)", () => {
    expect(
      pickTikTokVideoUrl({
        mediaUrls: [
          "https://api.apify.com/cover.jpg",
          "https://api.apify.com/v.mp4",
        ],
        videoMeta: { downloadAddr: "https://tiktokcdn.com/play-540p.mp4" },
      }),
    ).toBe("https://api.apify.com/v.mp4");
  });

  it("retombe sur downloadAddr si mediaUrls vide", () => {
    expect(
      pickTikTokVideoUrl({
        mediaUrls: [],
        videoMeta: { downloadAddr: "https://tiktokcdn.com/dl.mp4" },
      }),
    ).toBe("https://tiktokcdn.com/dl.mp4");
  });
});
