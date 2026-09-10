import { describe, expect, it } from "vitest";

import {
  argsFfmpegRemarque,
  cheminVideoRemarque,
  formaterOctets,
  refusFichierVideo,
  SOURCE_OCTETS_MAX,
} from "./videoRemarque";

const fichier = (over: Partial<{ name: string; size: number; type: string }> = {}) => ({
  name: "capture.mov",
  size: 4 * 1024 * 1024,
  type: "video/quicktime",
  ...over,
});

describe("refusFichierVideo", () => {
  it("accepte un screen recording macOS", () => {
    expect(refusFichierVideo(fichier())).toBeNull();
  });

  it("accepte un .mov sans type MIME — le navigateur n'en donne pas toujours", () => {
    expect(refusFichierVideo(fichier({ type: "" }))).toBeNull();
    expect(refusFichierVideo(fichier({ type: "application/octet-stream" }))).toBeNull();
  });

  it("accepte un type vidéo même avec une extension inconnue", () => {
    expect(refusFichierVideo(fichier({ name: "capture", type: "video/mp4" }))).toBeNull();
  });

  it("refuse ce qui n'est pas une vidéo", () => {
    expect(refusFichierVideo(fichier({ name: "note.pdf", type: "application/pdf" }))).toBe(
      "pas_une_video",
    );
  });

  it("refuse un fichier vide ou un export trop lourd", () => {
    expect(refusFichierVideo(fichier({ size: 0 }))).toBe("vide");
    expect(refusFichierVideo(fichier({ size: SOURCE_OCTETS_MAX + 1 }))).toBe("trop_gros");
  });
});

describe("argsFfmpegRemarque", () => {
  const args = argsFfmpegRemarque();

  it("retire le son — c'est ce qui autorise la lecture auto sur iPhone", () => {
    expect(args).toContain("-an");
  });

  it("sort du H.264 yuv420p, lisible hors Safari", () => {
    expect(args).toContain("libx264");
    expect(args).toContain("yuv420p");
  });

  it("met l'index en tête, sinon la lecture attend tout le fichier", () => {
    expect(args).toContain("+faststart");
  });

  it("réduit sans jamais agrandir", () => {
    const vf = args[args.indexOf("-vf") + 1];
    expect(vf).toContain("min(720,iw)");
    // Hauteur paire imposée par yuv420p.
    expect(vf).toContain("-2");
  });

  it("coupe au-delà de la durée max", () => {
    expect(argsFfmpegRemarque(12)[args.indexOf("-t")]).toBeDefined();
    expect(argsFfmpegRemarque(12)).toContain("12");
  });
});

describe("cheminVideoRemarque", () => {
  it("un fichier par puce : redéposer remplace", () => {
    expect(cheminVideoRemarque("hook-trop-petit")).toBe(
      "reviews/remarques/hook-trop-petit.mp4",
    );
  });
});

describe("formaterOctets", () => {
  it("reste lisible d'un octet à plusieurs mégas", () => {
    expect(formaterOctets(512)).toBe("512 o");
    expect(formaterOctets(2048)).toBe("2 Ko");
    expect(formaterOctets(3 * 1024 * 1024)).toBe("3.0 Mo");
  });
});
