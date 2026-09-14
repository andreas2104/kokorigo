import type JSZip from "jszip";

export async function readEpubXml(zip: JSZip, path: string): Promise<Document> {
  const entry = zip.file(path);
  if (!entry) throw new Error(`EPUB file missing: ${path}`);
  return new DOMParser().parseFromString(await entry.async("text"), "application/xml");
}

export function resolveEpubPath(base: string, href: string): string {
  const directory = base.includes("/") ? base.slice(0, base.lastIndexOf("/") + 1) : "";
  const parts = `${directory}${decodeURIComponent(href.split("#")[0])}`.split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return resolved.join("/");
}

export async function readEpubPackage(zip: JSZip): Promise<{ opf: Document; opfPath: string }> {
  const container = await readEpubXml(zip, "META-INF/container.xml");
  const opfPath = container.querySelector("rootfile")?.getAttribute("full-path");
  if (!opfPath) throw new Error("EPUB container has no package document");
  return { opf: await readEpubXml(zip, opfPath), opfPath };
}
