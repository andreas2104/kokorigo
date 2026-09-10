export type TextToken = {
  text: string;
  wordIndex: number | null;
};

export type WordTiming = {
  wordIndex: number;
  start: number;
  end: number;
};

const VOWEL_GROUP = /[aeiouyàâäæéèêëîïôöœùûüÿ]+/gi;

export function tokenizeText(text: string): TextToken[] {
  let wordIndex = 0;

  return (text.match(/\s+|[^\s]+/g) ?? []).map((part) => {
    if (/^\s+$/.test(part)) return { text: part, wordIndex: null };
    return { text: part, wordIndex: wordIndex++ };
  });
}

function spokenWeight(token: string): number {
  const syllables = token.match(VOWEL_GROUP)?.length ?? 1;
  const commaPause = /[,;:]$/.test(token) ? 0.45 : 0;
  const sentencePause = /[.!?…]$/.test(token) ? 0.8 : 0;
  return 0.7 + syllables * 0.55 + commaPause + sentencePause;
}

export function buildWordTimings(tokens: TextToken[]): WordTiming[] {
  const words = tokens.filter((token): token is TextToken & { wordIndex: number } => token.wordIndex !== null);
  if (!words.length) return [];

  const weights = words.map((token) => spokenWeight(token.text));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let elapsedWeight = 0;

  return words.map((token, index) => {
    const start = elapsedWeight / totalWeight;
    elapsedWeight += weights[index];
    return { wordIndex: token.wordIndex, start, end: elapsedWeight / totalWeight };
  });
}

export function wordIndexAtProgress(timings: WordTiming[], progress: number): number | null {
  if (!timings.length) return null;
  const clampedProgress = Math.min(1, Math.max(0, progress));
  return timings.find((timing) => clampedProgress < timing.end)?.wordIndex
    ?? timings[timings.length - 1].wordIndex;
}
