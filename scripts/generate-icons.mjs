// Render the versioned SVG at native icon sizes; never needs image service credentials.
import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
const svg = await readFile(
  new URL("../public/favicon.svg", import.meta.url),
  "utf8",
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
});
try {
  await mkdir(new URL("../public/icons/", import.meta.url), {
    recursive: true,
  });
  for (const [name, size, maskable] of [
    ["favicon-32", 32, false],
    ["apple-touch-icon", 180, false],
    ["icon-192", 192, false],
    ["icon-512", 512, false],
    ["maskable-512", 512, true],
  ]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<html><style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${maskable ? svg.replace('rx="14"', "") : svg}</html>`,
    );
    await page.screenshot({
      path: new URL(`../public/icons/${name}.png`, import.meta.url).pathname,
      omitBackground: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
