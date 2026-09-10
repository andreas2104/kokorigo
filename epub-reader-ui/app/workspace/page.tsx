import WorkspaceReader from "@/components/workspace-reader";

export const metadata = {
  title: "Workspace de lecture · Kokorigo",
  description: "Interface de lecture EPUB et de synthèse vocale Piper TTS.",
};

export default function WorkspacePage() {
  return <WorkspaceReader />;
}
