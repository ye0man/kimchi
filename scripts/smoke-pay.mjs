import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = "http://127.0.0.1:5173";
const RELAYS =
  "wss://relay.damus.io, wss://nos.lol, wss://relay.primal.net";
const TOKEN = process.env.KIMCHI_TOKEN ?? "";
const PROOFS = process.env.KIMCHI_PROOFS ?? "";
const TOTAL = process.env.KIMCHI_TOTAL ?? "1000";

if (!TOKEN && !PROOFS) {
  console.error("set KIMCHI_TOKEN or KIMCHI_PROOFS");
  process.exit(1);
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const contextA = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const contextB = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const pageA = await contextA.newPage();
const pageB = await contextB.newPage();

for (const [label, page] of [
  ["A", pageA],
  ["B", pageB],
]) {
  page.on("pageerror", (error) => console.log(`PAGEERROR ${label}`, error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("WebSocket"))
      console.log(`CONSOLE ${label}`, message.text());
  });
}

async function signIn(page, name) {
  await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
  await page.fill("#name", name);
  await page.fill("#relay", RELAYS);
  await page.click('button:has-text("Generate identity")');
  await page.waitForURL("**/groups", { timeout: 30000 });
  await page.waitForTimeout(8000);
}

if (PROOFS && fs.existsSync(PROOFS)) {
  const saved = JSON.parse(fs.readFileSync(PROOFS, "utf8"));
  await pageB.addInitScript(({ key, value }) => {
    localStorage.setItem(key, value);
  }, saved);
  console.log("restored saved guest proofs");
}

try {
  await signIn(pageA, "Minji");
  await signIn(pageB, "Alex");

  await pageB.click('button[title="Show my invite QR"]');
  await pageB.waitForSelector('summary:has-text("Show key package JSON")', {
    timeout: 10000,
  });
  await pageB.click('summary:has-text("Show key package JSON")');
  const bKeyPackage = await pageB.locator("#my-key-package").inputValue();
  if (!bKeyPackage.includes('"kind":30443')) throw new Error("missing key package");
  await pageB.keyboard.press("Escape");

  await pageA.click('button[title="New group"]');
  await pageA.waitForSelector("#group-name", { timeout: 10000 });
  await pageA.fill("#group-name", "Kimchi pay test");
  await pageA.fill("#group-relays", RELAYS);
  await pageA.fill("#group-key-package", bKeyPackage);
  await pageA.click("#group-key-package-add");
  await pageA.waitForSelector('button:has-text("Create and invite")', {
    timeout: 15000,
  });
  await pageA.click('button:has-text("Create and invite")');
  await pageA.waitForURL(/\/groups\/[0-9a-f]{16,}/, { timeout: 60000 });
  const groupUrl = pageA.url();

  await pageB.goto(`${BASE}/invites`, { waitUntil: "networkidle" });
  await pageB.waitForTimeout(4000);
  if (!(await pageB.locator('button:has-text("Accept invite")').count())) {
    await pageB.reload({ waitUntil: "networkidle" });
    await pageB.waitForTimeout(4000);
  }
  await pageB.waitForSelector('button:has-text("Accept invite")', {
    timeout: 45000,
  });
  await pageB.click('button:has-text("Accept invite")');
  await pageB.waitForTimeout(8000);

  await pageA.goto(`${groupUrl}/kimchi`, { waitUntil: "networkidle" });
  await pageA.waitForSelector("#kimchi-title", { timeout: 20000 });
  await pageA.fill("#kimchi-title", "Seoul dinner");
  await pageA.fill("#kimchi-total", TOTAL);
  await pageA.click("#kimchi-create");
  await pageA.waitForFunction(
    () => document.body.innerText.includes("Seoul dinner"),
    { timeout: 30000 },
  );

  await pageB.goto(`${groupUrl}/kimchi`, { waitUntil: "networkidle" });
  await pageB.waitForTimeout(5000);
  if (!(await pageB.locator("#kimchi-pay").count())) {
    await pageB.reload({ waitUntil: "networkidle" });
    await pageB.waitForTimeout(6000);
  }

  if (TOKEN) {
    await pageB.click("#kimchi-wallet summary");
    await pageB.fill("#kimchi-token", TOKEN);
    await pageB.click("#kimchi-receive");
    await pageB.waitForTimeout(6000);
    const saved = await pageB.evaluate(() => {
      const key = Object.keys(localStorage).find((entry) =>
        entry.startsWith("kimchi:proofs:"),
      );
      return key ? { key, value: localStorage.getItem(key) } : null;
    });
    if (saved) {
      const path =
        PROOFS ||
        "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-proofs.json";
      fs.writeFileSync(path, JSON.stringify(saved));
      console.log("saved guest proofs", path);
    }
  }
  const balance = await pageB.textContent("#kimchi-wallet summary");
  console.log("guest wallet:", balance?.trim());

  await pageB.click("#kimchi-pay");
  await pageB.waitForTimeout(6000);

  await pageA.reload({ waitUntil: "networkidle" });
  await pageA.waitForTimeout(4000);
  await pageA.click("#kimchi-wallet summary").catch(() => {});
  await pageA.waitForSelector("#kimchi-redeem:not([disabled])", {
    timeout: 45000,
  });
  await pageA.click("#kimchi-redeem");
  await pageA.waitForTimeout(8000);

  await pageB.reload({ waitUntil: "networkidle" });
  await pageB.waitForTimeout(6000);
  const guestBody = await pageB.textContent("body");
  console.log("guest paid:", guestBody?.includes("Paid"));
  if (!guestBody?.includes("Paid")) {
    console.log("GUEST BODY", guestBody?.slice(0, 1600));
    throw new Error("guest did not see a paid state");
  }

  await pageA.waitForSelector("#kimchi-settle", { timeout: 30000 });
  await pageA.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-paid-host.png",
    fullPage: true,
  });
  await pageB.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-paid-guest.png",
    fullPage: true,
  });
  console.log("OK");
} catch (error) {
  console.log("FAILED", error instanceof Error ? error.message : String(error));
  await pageA.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-pay-host-fail.png",
    fullPage: true,
  });
  await pageB.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-pay-guest-fail.png",
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await browser.close();
}
