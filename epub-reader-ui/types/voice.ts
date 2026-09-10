export type Voice = {
  id: string;
  engine: "piper" | "kokoro";
  name: string;
  language: string;
  character: string;
  description?: string;
  model?: string;
  available: boolean;
};
