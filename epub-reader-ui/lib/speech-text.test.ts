import { describe, expect, it } from "vitest";
import { sanitizeTextForSpeech } from "./speech-text";

describe("speech text", () => {
  it("removes Markdown formatting and symbols that should stay silent", () => {
    expect(sanitizeTextForSpeech("*** # Chapitre [premier] — © Éditions Plon"))
      .toBe("Chapitre premier Éditions Plon");
  });

  it("keeps natural pauses and replaces exclamation marks with a pause", () => {
    expect(sanitizeTextForSpeech("Bonjour,comment allez-vous? Très bien!"))
      .toBe("Bonjour, comment allez vous? Très bien.");
  });

  it("returns an empty value for a formatting-only separator", () => {
    expect(sanitizeTextForSpeech("* * *")).toBe("");
  });
});
