import { describe, expect, it } from "vitest";

import { postsDuJour } from "@/features/moteur/calendrierPoster";

import { entreeCalendrierUgc, nomFichierVideo, type PublicationUgc } from "./publications";

const pub: PublicationUgc = {
  id: "11111111-2222-3333-4444-555555555555",
  compte_id: "c1",
  date_publication_prevue: "2026-10-06",
  video_url: "https://x/v.mp4",
  demo_url: null,
  texte: "POV",
  capture_url: null,
  legende: "",
  musique_url: null,
  statut: "assigne",
  publie_at: null,
  publie_url: null,
};

describe("entreeCalendrierUgc", () => {
  it("ouvre la page vidéo, pas celle d'un post", () => {
    const e = entreeCalendrierUgc(pub, "Vidéo du jour");
    expect(e.lien).toBe(`/ugc/${pub.id}`);
    expect(e.type).toBe("video");
    expect(e.sujet_titre).toBe("Vidéo du jour");
  });

  it("passe par le même « Aujourd'hui » et les mêmes retards qu'un post", () => {
    const veille = entreeCalendrierUgc({ ...pub, id: "a", date_publication_prevue: "2026-10-05" }, "V");
    const jour = entreeCalendrierUgc(pub, "V");
    const publieeVeille = entreeCalendrierUgc(
      { ...pub, id: "b", date_publication_prevue: "2026-10-05", publie_at: "2026-10-05T18:00:00Z" },
      "V",
    );
    const { duJour, enRetard } = postsDuJour([veille, jour, publieeVeille], "2026-10-06", "c1");
    expect(duJour.map((p) => p.id)).toEqual([pub.id]);
    expect(enRetard.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("nomFichierVideo", () => {
  it("nomme le fichier par le compte et le jour", () => {
    expect(nomFichierVideo("@eva.learn", "2026-10-06", "video")).toBe("eva.learn-2026-10-06.mp4");
    expect(nomFichierVideo("eva.learn", "2026-10-06", "demo")).toBe("eva.learn-2026-10-06-demo.mp4");
  });

  it("retombe sur micabo sans pseudo", () => {
    expect(nomFichierVideo(null, "2026-10-06", "video")).toBe("micabo-2026-10-06.mp4");
  });
});
