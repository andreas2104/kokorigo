import { test, expect } from "@playwright/test";
import JSZip from "jszip";

// Minimal valid EPUB (mimetype, container, package and one XHTML chapter).
const MINIMAL_EPUB =
  "UEsDBBQAAAAAAAAAIQBvYassFAAAABQAAAAIAAAAbWltZXR5cGVhcHBsaWNhdGlvbi9lcHViK3ppcFBLAwQUAAAACAAAACEAHgvXyZkAAADdAAAAFgAAAE1FVEEtSU5GL2NvbnRhaW5lci54bWxVjsEOwiAQRH+l4Wpa9EoAExPPmvgFK90qEXYJUKN/L3qoeptk5s2M3j5i6O6Yi2cyYjOsxdZqx1TBE+Z/p2tZKkbMmRRD8UURRCyqOsUJaWQ3R6SqPjG1lAirM3OdfMDyld00h9AnqFcjDvvd8STfQMMHTpPoIo4e+vpMaASkFLyD2o5IxnMqDXM3uOCqLQlptfzpl8uufQFQSwMEFAAAAAgAAAAhACosjKsBAQAArgEAABEAAABPRUJQUy9jb250ZW50Lm9wZlWQwW6EIBCGX4VwbRRtD20MukmT9tzD7gMQGHRSRIpj3b59EbduegO+fz5mRp6uo2PfEGecfMvrsuIMvJ4M+r7ll/N78cJPnQxKf6oeWAr7ueUDUWiEWNe1RBNsOcVePFbVs5iC5Xfb02ZbPH4tUKABT2gRYsvR8E6OQMooUruzMfrQhiW6rDRagIMxFc6iLmuRqoxu7iaGZpcRzCTFP5ajhOSgOyfK3j4urzmyv23UKd8vaarOxkyOuxR/zaU2lUebBJ1EgjH/qAcVOBsi2P1MEMvrQKPjbASDqqCfAC1XITjUitIqRMYPaVIuNvvhnAN62NVJl+yHNAdvWNzW3/0CUEsDBBQAAAAIAAAAIQBudUZblQAAALwAAAATAAAAT0VCUFMvY2hhcHRlci54aHRtbCWNQQ6CMBBFrzLpATo2rjClJBj3bjwAwmBroK1lsHh7S1j+91/+1802T/CltLjga6HkSTRGWy6wFH6phWWOF8Scs8xnGdILVVVVuO2OKCp1g9HseCJztV10nEjjkTUe7TMMv2Iq0wb/DmsqXBkdzZWAaWOCPvjRpZngsxJMBKPrraMEt/ujBVoYplVqjGXwmML93PwBUEsBAhQDFAAAAAAAAAAhAG9hqywUAAAAFAAAAAgAAAAAAAAAAAAAAIABAAAAAG1pbWV0eXBlUEsBAhQDFAAAAAgAAAAhAB4L18mZAAAA3QAAABYAAAAAAAAAAAAAAIABOgAAAE1FVEEtSU5GL2NvbnRhaW5lci54bWxQSwECFAMUAAAACAAAACEAKiyMqwEBAACuAQAAEQAAAAAAAAAAAAAAgAEHAQAAT0VCUFMvY29udGVudC5vcGZQSwECFAMUAAAACAAAACEAbnVGW5UAAAC8AAAAEwAAAAAAAAAAAAAAgAE3AgAAT0VCUFMvY2hhcHRlci54dG1sUEsFBgAAAAAABAAEAPoAAAD9AgAAAAA=";

async function makeTestEpub(chapterBody = "<h1>Chapitre de test</h1><p>Ce texte confirme que le fichier EPUB est lu.</p>"): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file("OEBPS/content.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test</dc:title></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>`);
  zip.file("OEBPS/chapter.xhtml", `<html xmlns="http://www.w3.org/1999/xhtml"><body>${chapterBody}</body></html>`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

test("lit un EPUB après sélection et termine l'extraction", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Choisir un fichier EPUB").setInputFiles({
    name: "test.epub",
    mimeType: "application/epub+zip",
    buffer: await makeTestEpub(),
  });

  await expect(page.getByText("Extraction des paragraphes…")).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText("Ce texte confirme que le fichier EPUB est lu.")).toBeVisible();
  await expect(page.getByText("Page 1 / 1")).toBeVisible();
});

test("active et mémorise le mode sombre", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  await page.getByRole("button", { name: "Activer le mode nuit" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "Activer le mode jour" })).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "Activer le mode jour" })).toBeVisible();
});

test("ouvre le lecteur dans le workspace depuis l’historique", async ({ page }) => {
  const epub = await makeTestEpub();
  await page.route("**/api/my-library**", async (route) => {
    if (route.request().url().endsWith("/file/7")) {
      await route.fulfill({ status: 200, contentType: "application/epub+zip", body: epub });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        id: 7,
        title: "Livre historique",
        author: "Auteur test",
        coverUrl: "",
        fileName: "historique.epub",
        addedAt: new Date().toISOString(),
      }]),
    });
  });
  await page.goto("/");

  await page.getByRole("button", { name: /Livre historique.*Lire/ }).click();
  await expect(page.getByText("Ce texte confirme que le fichier EPUB est lu.")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Bibliothèque" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lecture vocale" })).toBeVisible();
  await expect(page.getByText("Cliquez sur un mot pour lire à partir de cet endroit")).toBeVisible();
});

test("commence la lecture au mot sélectionné", async ({ page }) => {
  let spokenText = "";
  await page.route("**/api/v1/tts", async (route) => {
    spokenText = (await route.request().postDataJSON()).text;
    await route.fulfill({ status: 200, contentType: "audio/wav", body: Buffer.alloc(44) });
  });
  await page.goto("/");
  await page.getByLabel("Choisir un fichier EPUB").setInputFiles({
    name: "test.epub",
    mimeType: "application/epub+zip",
    buffer: await makeTestEpub(),
  });

  await page.getByRole("button", { name: "Lire à partir de « confirme »" }).click();
  await expect.poll(() => spokenText).toBe("confirme que le fichier EPUB est lu.");
});

test("va directement à la page saisie", async ({ page }) => {
  const chapterBody = Array.from(
    { length: 30 },
    (_, index) => `<p>Paragraphe ${index + 1}. ${"Un contenu assez long pour construire plusieurs pages. ".repeat(3)}</p>`,
  ).join("");
  await page.goto("/");
  await page.getByLabel("Choisir un fichier EPUB").setInputFiles({
    name: "long.epub",
    mimeType: "application/epub+zip",
    buffer: await makeTestEpub(chapterBody),
  });

  await expect(page.getByText(/^Page 1 \/ [2-9]\d*$/)).toBeVisible();
  await page.getByLabel("Numéro de page").fill("2");
  await page.getByRole("button", { name: "Aller" }).click();
  await expect(page.getByText(/^Page 2 \/ \d+$/)).toBeVisible();
});

test("mémorise le dernier mot lu après la fermeture du livre", async ({ page }) => {
  await page.route("**/api/v1/tts", async (route) => {
    await route.fulfill({ status: 200, contentType: "audio/wav", body: Buffer.alloc(44) });
  });
  const buffer = await makeTestEpub();
  const file = { name: "position.epub", mimeType: "application/epub+zip", buffer };
  await page.goto("/");
  await page.getByLabel("Choisir un fichier EPUB").setInputFiles(file);
  await page.getByRole("button", { name: "Lire à partir de « confirme »" }).click();
  await page.getByRole("button", { name: "Pause" }).first().click();
  await page.getByRole("button", { name: "Fermer" }).click();
  await expect.poll(() => page.evaluate(() =>
    Object.entries(localStorage).find(([key]) => key.startsWith("kokorigo:reading-position"))?.[1],
  )).toContain('"wordIndex":2');

  await page.getByLabel("Choisir un fichier EPUB").setInputFiles(file);
  await expect(page.getByRole("status")).toContainText("Vous vous êtes arrêté à la page 1, au paragraphe 2.");
  await expect(page.getByRole("button", { name: "Lire à partir de « confirme »" }))
    .toHaveAttribute("aria-current", "true");
});

test("démarre la lecture avec la touche espace", async ({ page }) => {
  await page.route("**/api/v1/tts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: Buffer.alloc(44),
    });
  });
  await page.goto("/");
  await page.getByLabel("Choisir un fichier EPUB").setInputFiles({
    name: "test.epub",
    mimeType: "application/epub+zip",
    buffer: await makeTestEpub(),
  });
  await expect(page.getByText("Ce texte confirme que le fichier EPUB est lu.")).toBeVisible();

  const ttsRequest = page.waitForRequest((request) =>
    request.url().includes("/api/v1/tts") && request.method() === "POST",
  );
  await page.keyboard.press("Space");
  await ttsRequest;
});

test("lit un EPUB réel avec Piper et reçoit un WAV français", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choisir un fichier EPUB").setInputFiles({
    name: "test.epub",
    mimeType: "application/epub+zip",
    buffer: await makeTestEpub(),
  });

  await expect(page.getByText("Ce texte confirme que le fichier EPUB est lu.")).toBeVisible();
  const audioResponse = page.waitForResponse((response) =>
    response.url().includes("/api/v1/tts") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Lecture" }).click();
  const response = await audioResponse;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("audio/wav");
  expect(Number(response.headers()["content-length"])).toBeGreaterThan(44);
});
