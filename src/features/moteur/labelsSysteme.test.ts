import { describe, expect, it } from "vitest";

import {
  extraireLabelsAssignables,
  idsLabelsAssignables,
} from "../../../supabase/functions/_shared/labels_systeme.ts";

describe("labels système — pas d'assignation créateur", () => {
  it("retire hook et ugc-ai-video du pool", () => {
    expect(
      idsLabelsAssignables([
        { id: "hook", slug: "hook" },
        { id: "study", slug: "study-aes" },
        { id: "ugc", slug: "ugc-ai-video" },
      ]),
    ).toEqual(["study"]);
  });

  it("ignore hook sur un compte au matching minuit", () => {
    const { labelIds, labelNoms } = extraireLabelsAssignables([
      { label_id: "h", labels: { nom: "Hook", slug: "hook" } },
      { label_id: "s", labels: { nom: "Study AES", slug: "study-aes" } },
    ]);
    expect(labelIds).toEqual(["s"]);
    expect(labelNoms).toEqual(["Study AES"]);
  });
});
