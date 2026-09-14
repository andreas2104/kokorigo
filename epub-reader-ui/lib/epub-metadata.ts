import JSZip from "jszip";
import { readEpubPackage, resolveEpubPath } from "@/lib/epub-package";

const DUBLIN_CORE = "http://purl.org/dc/elements/1.1/";
// Une couverture plus lourde gonflerait inutilement la base locale du navigateur.
const MAX_COVER_BYTES = 400_000;

export type EpubMetadata = {
  title: string;
  author: string;
  coverDataUrl: string;
};

function readDublinCore(opf: Document, name: string): string {
  const element = opf.getElementsByTagNameNS(DUBLIN_CORE, name)[0]
    ?? opf.getElementsByTagName(`dc:${name}`)[0];
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function findCoverItem(opf: Document): Element | null {
  const items = Array.from(opf.querySelectorAll("manifest > item"));
  const declared = items.find((item) =>
    (item.getAttribute("properties") ?? "").split(/\s+/).includes("cover-image"),
  );
  if (declared) return declared;

  const coverId = Array.from(opf.querySelectorAll("metadata > meta"))
    .find((meta) => meta.getAttribute("name") === "cover")
    ?.getAttribute("content");
  const referenced = coverId && items.find((item) => item.getAttribute("id") === coverId);
  if (referenced) return referenced;

  return items.find((item) =>
    (item.getAttribute("media-type") ?? "").startsWith("image/")
    && /cover/i.test(item.getAttribute("href") ?? ""),
  ) ?? null;
}

async function readCover(zip: JSZip, opf: Document, opfPath: string): Promise<string> {
  const item = findCoverItem(opf);
  const href = item?.getAttribute("href");
  if (!item || !href) return "";

  const entry = zip.file(resolveEpubPath(opfPath, href));
  if (!entry) return "";

  const base64 = await entry.async("base64");
  if (base64.length * 0.75 > MAX_COVER_BYTES) return "";
  return `data:${item.getAttribute("media-type") || "image/jpeg"};base64,${base64}`;
}

// Le serveur extrait ces métadonnées à l'import. Hors ligne, le navigateur fait
// le même travail pour que la bibliothèque locale reste lisible.
export async function readEpubMetadata(file: File): Promise<EpubMetadata> {
  const fallbackTitle = file.name.replace(/\.epub$/i, "");
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const { opf, opfPath } = await readEpubPackage(zip);
    return {
      title: readDublinCore(opf, "title") || fallbackTitle,
      author: readDublinCore(opf, "creator"),
      coverDataUrl: await readCover(zip, opf, opfPath).catch(() => ""),
    };
  } catch {
    return { title: fallbackTitle, author: "", coverDataUrl: "" };
  }
}
