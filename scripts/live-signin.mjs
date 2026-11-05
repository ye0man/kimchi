import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1200, height: 900 },
  deviceScaleFactor: 2,
});
const errors = [];

page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("WebSocket")) {
    errors.push(`console: ${message.text()}`);
  }
});

await page.goto("https://www.jakedat.com/kimchi/signin", {
  waitUntil: "networkidle",
});
await page.waitForSelector(".kimchi-signin-card", { timeout: 20000 });
await page.waitForTimeout(1500);

const result = await page.evaluate(async () => {
  const card = document.querySelector(".kimchi-signin-card");
  const style = card ? getComputedStyle(card) : null;
  return {
    card: Boolean(card),
    background: style?.backgroundColor,
    radius: style?.borderRadius,
    jar: Boolean(document.querySelector(".kimchi-jar")),
    name: Boolean(document.querySelector("#name")),
    relay: Boolean(document.querySelector("#relay")),
    generate: [...document.querySelectorAll("button")].some((button) =>
      button.textContent?.includes("Generate identity"),
    ),
    tagline: document.body.innerText.includes("Share the date, not your data."),
    sw: (await navigator.serviceWorker.getRegistrations()).length,
  };
});

console.log(JSON.stringify(result, null, 2));
console.log("errors:", errors.length);
if (errors.length) console.log(errors.join("\n"));

await page.screenshot({
  path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-signin-live.png",
  fullPage: true,
});
await browser.close();
