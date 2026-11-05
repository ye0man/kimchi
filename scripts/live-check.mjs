import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];

page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("WebSocket")) {
    errors.push(`console: ${message.text()}`);
  }
});

await page.goto("https://www.jakedat.com/kimchi/", {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(6000);

const body = await page.textContent("body");
console.log("url:", page.url());
console.log(
  "signin rendered:",
  Boolean(body?.includes("Kimchi") && body.includes("Generate identity")),
);
console.log("manifest:", await page.getAttribute('link[rel="manifest"]', "href"));
console.log(
  "sw registrations:",
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
);
console.log("errors:", errors.length);
if (errors.length) console.log(errors.join("\n"));

await page.screenshot({
  path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-live.png",
  fullPage: true,
});
await browser.close();
