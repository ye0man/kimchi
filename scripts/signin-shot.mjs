import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1200, height: 900 },
  deviceScaleFactor: 1,
});
await page.goto("http://127.0.0.1:5173/signin", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.screenshot({
  path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-signin.png",
  fullPage: true,
});
console.log("ok");
await browser.close();

