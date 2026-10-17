// Run against the production preview, not Vite development (which disables SW).
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const base = process.env.PWA_URL || "http://127.0.0.1:4173";
const profile = await mkdtemp(join(tmpdir(), "safenota-pwa-"));
const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
try {
  const page = await context.newPage();
  await page.goto(base);
  const manifestPath = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  const manifest = await (
    await context.request.get(new URL(manifestPath, base).href)
  ).json();
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.short_name, "SafeNota");
  for (const icon of manifest.icons) {
    const actual = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return `${img.naturalWidth}x${img.naturalHeight}`;
    }, icon.src);
    assert.equal(actual, icon.sizes);
  }
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cdp = await context.newCDPSession(page);
  const info = await cdp.send("Page.getAppManifest");
  assert.equal(info.errors.length, 0, JSON.stringify(info.errors));
  const installability = await cdp.send("Page.getInstallabilityErrors");
  assert.deepEqual(
    installability.installabilityErrors,
    [],
    JSON.stringify(installability),
  );
  const cached = await page.evaluate(async () => {
    const cache = await caches.open("safenota-offline-v1");
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
  assert.deepEqual(cached, ["/offline.html"]);
  await context.setOffline(true);
  await page.goto(`${base}/receber`);
  await page.getByRole("heading", { name: "Você está sem conexão" }).waitFor();
  await context.setOffline(false);
  await page.goto(base);
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await page.getByRole("heading", { name: "Seu trabalho, em dia." }).waitFor();
  console.log(
    "PASS: Chrome accepts manifest/icons, installation criteria pass, service worker serves offline fallback, app resumes online; only static offline page cached.",
  );
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
}
