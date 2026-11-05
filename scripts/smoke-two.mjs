import { chromium } from "playwright-core";

const BASE = "http://127.0.0.1:5173";
const RELAYS =
  "wss://relay.damus.io, wss://nos.lol, wss://relay.primal.net";

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
    if (message.text().includes("kimchi:discovery"))
      console.log(`CONSOLE ${label}`, message.text());
    else if (
      message.type() === "error" &&
      !message.text().includes("WebSocket")
    )
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

try {
  await signIn(pageA, "Minji");
  await signIn(pageB, "Alex");
  console.log("both signed in");

  await pageB.click('button[title="Show my invite QR"]');
  await pageB.waitForSelector("code", { timeout: 10000 });
  const bNpub = (await pageB.textContent("code"))?.trim();
  if (!bNpub?.startsWith("npub1")) throw new Error("missing npub");
  console.log("invitee npub", bNpub.slice(0, 16));
  await pageB.keyboard.press("Escape");

  await pageA.click('button[title="New group"]');
  await pageA.waitForSelector("#group-name", { timeout: 10000 });
  await pageA.fill("#group-name", "Kimchi dinner");
  await pageA.fill("#group-relays", RELAYS);
  await pageA.fill("#group-contact", bNpub);
  await pageA.click('button:has-text("Find")');
  await pageA.waitForSelector('button:has-text("Create and invite")', {
    timeout: 45000,
  });
  await pageA.click('button:has-text("Create and invite")');
  await pageA.waitForURL(/\/groups\/[0-9a-f]{16,}/, { timeout: 60000 });
  const groupUrl = pageA.url();
  console.log("group", groupUrl);

  await pageB.goto(`${BASE}/invites`, { waitUntil: "networkidle" });
  await pageB.waitForTimeout(4000);
  if (!(await pageB.locator('button:has-text("Accept invite")').count())) {
    await pageB.reload({ waitUntil: "networkidle" });
    await pageB.waitForTimeout(4000);
  }
  await pageB.waitForSelector('button:has-text("Accept invite")', { timeout: 45000 });
  await pageB.click('button:has-text("Accept invite")');
  await pageB.waitForTimeout(8000);
  console.log("invitee joined", pageB.url());

  await pageA.goto(`${groupUrl}/kimchi`, { waitUntil: "networkidle" });
  await pageA.waitForSelector("#kimchi-title", { timeout: 20000 });
  await pageA.fill("#kimchi-title", "Seoul dinner");
  await pageA.fill("#kimchi-total", "18000");
  await pageA.click("#kimchi-create");
  await pageA.waitForFunction(
    () => document.body.innerText.includes("Seoul dinner"),
    { timeout: 30000 },
  );
  console.log("host tab created");

  const guestUrl = `${groupUrl}/kimchi`;
  await pageB.goto(guestUrl, { waitUntil: "networkidle" });
  await pageB.waitForTimeout(5000);
  let guestBody = await pageB.textContent("body");
  if (!guestBody?.includes("Pay with ecash")) {
    await pageB.reload({ waitUntil: "networkidle" });
    await pageB.waitForTimeout(6000);
    guestBody = await pageB.textContent("body");
  }
  console.log("guest sees pay:", guestBody?.includes("Pay with ecash"));
  if (!guestBody?.includes("Pay with ecash")) {
    console.log("GUEST BODY", guestBody?.slice(0, 1600));
    throw new Error("guest did not see their share");
  }

  await pageA.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-host.png",
    fullPage: true,
  });
  await pageB.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-guest.png",
    fullPage: true,
  });

  pageA.on("dialog", (dialog) => dialog.accept());
  await pageA.click("#kimchi-close");
  await pageA.waitForURL("**/groups", { timeout: 30000 });
  await pageA.waitForTimeout(3000);
  await pageB.waitForTimeout(4000);
  const guestClosed = await pageB.textContent("body");
  console.log("guest sees closed:", guestClosed?.includes("This tab is closed."));
  console.log("OK");
} catch (error) {
  console.log("FAILED", error instanceof Error ? error.message : String(error));
  await pageA.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-host-fail.png",
    fullPage: true,
  });
  await pageB.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-guest-fail.png",
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await browser.close();
}
