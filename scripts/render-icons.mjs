import { chromium } from "playwright-core";
import fs from "node:fs";

const svg = fs.readFileSync("public/icon-kimchi.svg", "utf8");
const browser = await chromium.launch({ channel: "msedge", headless: true });

for (const [size, file] of [
  [192, "icon-192.png"],
  [512, "icon-512.png"],
  [192, "icon-192-maskable.png"],
  [512, "icon-512-maskable.png"],
  [180, "apple-touch-icon.png"],
  [32, "favicon-32.png"],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: `public/${file}`, omitBackground: true });
  await page.close();
  console.log("wrote", file, size);
}

await browser.close();
