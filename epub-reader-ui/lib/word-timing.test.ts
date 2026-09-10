import { describe, expect, it } from "vitest";
import { buildWordTimings, tokenizeText, wordIndexAtProgress } from "./word-timing";

describe("word timing", () => {
  it("preserves spaces while assigning indexes only to words", () => {
    expect(tokenizeText("Bonjour,  le monde !")).toEqual([
      { text: "Bonjour,", wordIndex: 0 },
      { text: "  ", wordIndex: null },
      { text: "le", wordIndex: 1 },
      { text: " ", wordIndex: null },
      { text: "monde", wordIndex: 2 },
      { text: " ", wordIndex: null },
      { text: "!", wordIndex: 3 },
    ]);
  });

  it("returns one active word throughout playback", () => {
    const timings = buildWordTimings(tokenizeText("Un texte simple."));

    expect(wordIndexAtProgress(timings, 0)).toBe(0);
    expect(wordIndexAtProgress(timings, 0.5)).toBe(1);
    expect(wordIndexAtProgress(timings, 1)).toBe(2);
  });

  it("handles text without words", () => {
    expect(wordIndexAtProgress(buildWordTimings(tokenizeText("   ")), 0.5)).toBeNull();
  });
});
