import { chromium } from "playwright-core";

const BASE = "http://127.0.0.1:5173";
const RELAYS =
  "wss://relay.damus.io, wss://nos.lol, wss://relay.primal.net";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });

const errors = [];
page.on("console", (message) => {
  if (true) {
    errors.push(`console: ${message.text()}`);
    console.log("CONSOLE", message.text());
  }
});
page.on("pageerror", (error) => {
  errors.push(`pageerror: ${error.message}`);
  console.log("PAGEERROR", error.message);
});

try {
  await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
  await page.fill("#name", "Minji");
  await page.fill("#relay", RELAYS);
  await page.click('button:has-text("Generate identity")');
  await page.waitForURL("**/groups", { timeout: 30000 });
  console.log("signed in");
  await page.waitForTimeout(4000);

  await page.click('button[title="New group"]');
  await page.waitForSelector("#group-name", { timeout: 10000 });
  await page.fill("#group-name", "Kimchi smoke group");
  await page.fill("#group-relays", RELAYS);
  await page.click('button:has-text("Create group")');
  await page.waitForURL(/\/groups\/[0-9a-f]{16,}/, { timeout: 45000 });
  const groupUrl = page.url();
  console.log("group", groupUrl);

  await page.goto(`${groupUrl}/kimchi`, { waitUntil: "networkidle" });
  await page.waitForSelector("#kimchi-title", { timeout: 20000 });
  console.log("kimchi page loaded");

  await page.fill("#kimchi-title", "Seoul dinner");
  await page.fill("#kimchi-total", "18000");
  await page.click("#kimchi-create");
  await page.waitForFunction(() => document.body.innerText.includes("Seoul dinner") || document.body.innerText.includes("Creating"), { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(3000);
  const body = await page.textContent("body");
  if (!body?.includes("Seoul dinner")) {
    console.log("BODY", body?.slice(0, 1200));
    throw new Error("tab did not render after create");
  }
  console.log("tab created and rendered");
  await page.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-smoke.png",
    fullPage: true,
  });
  console.log("screenshot saved");
} catch (error) {
  console.log("FAILED", error instanceof Error ? error.message : String(error));
  await page.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-smoke-fail.png",
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  console.log("errors", errors.length);
  await browser.close();
}

