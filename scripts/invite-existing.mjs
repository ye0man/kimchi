import { chromium } from "playwright-core";

const BASE = "http://127.0.0.1:5173";
const RELAYS = "wss://relay.damus.io, wss://nos.lol, wss://relay.primal.net";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const contextA = await browser.newContext({
  viewport: { width: 1200, height: 900 },
});
const contextB = await browser.newContext({
  viewport: { width: 1200, height: 900 },
});
const pageA = await contextA.newPage();
const pageB = await contextB.newPage();

for (const [label, page] of [
  ["A", pageA],
  ["B", pageB],
]) {
  page.on("pageerror", (error) =>
    console.log(`PAGEERROR ${label}`, error.message),
  );
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
  await page.waitForTimeout(10000);
}

try {
  await signIn(pageA, "Host");
  await signIn(pageB, "Phone");
  console.log("both signed in");

  await pageB.click('button[title="Show my invite QR"]');
  await pageB.waitForSelector("code", { timeout: 10000 });
  const bNpub = (await pageB.textContent("code"))?.trim();
  if (!bNpub?.startsWith("npub1")) throw new Error("missing npub");
  console.log("invitee npub", bNpub.slice(0, 16));
  await pageB.keyboard.press("Escape");

  await pageA.click('button[title="New group"]');
  await pageA.waitForSelector("#group-name", { timeout: 10000 });
  await pageA.fill("#group-name", "Solo first");
  await pageA.fill("#group-relays", RELAYS);
  await pageA.click('button:has-text("Create group")');
  await pageA.waitForURL(/\/groups\/[0-9a-f]{16,}/, { timeout: 60000 });
  const groupUrl = pageA.url();
  console.log("group", groupUrl);

  await pageA.click('button[aria-label="Invite to group"]');
  await pageA.waitForSelector('input[placeholder^="npub1"]', {
    timeout: 10000,
  });
  await pageA.fill('input[placeholder^="npub1"]', bNpub);
  await pageA.click('button:has-text("Find")');
  await pageA.waitForTimeout(12000);
  console.log(
    "invite dialog",
    (await pageA.textContent('[role="dialog"]'))?.slice(0, 1200),
  );

  const inviteButton = pageA.locator('button:has-text("Invite")').last();
  if (await inviteButton.isEnabled()) {
    await inviteButton.click();
    console.log("clicked invite");
    await pageA.waitForTimeout(8000);
  } else {
    throw new Error("no invitable key package found");
  }

  await pageB.goto(`${BASE}/invites`, { waitUntil: "networkidle" });
  await pageB.waitForTimeout(8000);
  if (!(await pageB.locator('button:has-text("Accept invite")').count())) {
    await pageB.reload({ waitUntil: "networkidle" });
    await pageB.waitForTimeout(8000);
  }
  console.log(
    "invitee page",
    (await pageB.textContent("body"))?.slice(0, 1200),
  );
  if (await pageB.locator('button:has-text("Accept invite")').count()) {
    await pageB.click('button:has-text("Accept invite")');
    await pageB.waitForTimeout(8000);
    console.log("joined", pageB.url());
    console.log("OK");
  } else {
    throw new Error("no accept button on invitee");
  }
} catch (error) {
  console.log("FAILED", error instanceof Error ? error.message : String(error));
  await pageA.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-invite-host-fail.png",
    fullPage: true,
  });
  await pageB.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-invite-phone-fail.png",
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await browser.close();
}
