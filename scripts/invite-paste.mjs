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
    const text = message.text();
    if (
      text.includes("marmot") ||
      text.includes("welcome") ||
      message.type() === "error"
    )
      console.log(`CONSOLE ${label}`, text);
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
  await pageB.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await pageB.waitForFunction(
    () =>
      document.querySelector("#my-key-package") ||
      [...document.querySelectorAll("button")].some((b) =>
        (b.textContent ?? "").includes("Publish key package"),
      ),
    { timeout: 30000 },
  );
  if (!(await pageB.locator("#my-key-package").count())) {
    console.log("phone has no package, publishing");
    await pageB.click('button:has-text("Publish key package")');
    await pageB.waitForSelector("#my-key-package", {
      state: "attached",
      timeout: 30000,
    });
  }
  const keyPackageJson = await pageB.inputValue("#my-key-package");
  if (!keyPackageJson.includes("30443")) throw new Error("no key package");
  console.log("key package copied from phone", keyPackageJson.length, "chars");
  await pageB.keyboard.press("Escape");

  await pageA.click('button[title="New group"]');
  await pageA.waitForSelector("#group-name", { timeout: 10000 });
  await pageA.fill("#group-name", "Paste fallback");
  await pageA.fill("#group-relays", RELAYS);
  await pageA.click('button:has-text("Create group")');
  await pageA.waitForURL(/\/groups\/[0-9a-f]{16,}/, { timeout: 60000 });
  console.log("group", pageA.url());

  await pageA.click('button[aria-label="Invite to group"]');
  await pageA.waitForSelector("#invite-key-package", { timeout: 10000 });
  await pageA.fill("#invite-key-package", keyPackageJson);
  await pageA.click('button:has-text("Add key package")');
  await pageA.waitForTimeout(3000);
  console.log(
    "dialog",
    (await pageA.textContent('[role="dialog"]'))?.slice(0, 800),
  );
  const inviteButton = pageA.locator('button:has-text("Invite")').last();
  if (!(await inviteButton.isEnabled()))
    throw new Error("key package not invitable");
  await inviteButton.click();
  for (let i = 0; i < 12; i++) {
    await pageA.waitForTimeout(5000);
    const dialog = (await pageA.textContent('[role="dialog"]')) ?? "";
    console.log(`after ${(i + 1) * 5}s`, dialog.slice(-400));
    if (dialog.includes("Invite sent.")) break;
    if (dialog.includes("Action failed") || dialog.includes("Failed to send"))
      break;
  }
  if (
    !((await pageA.textContent('[role="dialog"]')) ?? "").includes(
      "Invite sent.",
    )
  )
    throw new Error("invite did not complete");
  console.log("host saw invite sent");
  await pageA.click('button:has-text("Done")');

  await pageB.goto(`${BASE}/invites`, { waitUntil: "networkidle" });
  await pageB.waitForTimeout(6000);
  if (!(await pageB.locator('button:has-text("Accept invite")').count())) {
    await pageB.reload({ waitUntil: "networkidle" });
    await pageB.waitForTimeout(6000);
  }
  if (await pageB.locator('button:has-text("Accept invite")').count()) {
    await pageB.click('button:has-text("Accept invite")');
    await pageB.waitForTimeout(8000);
    console.log("joined", pageB.url());
    console.log("OK");
  } else {
    throw new Error("no accept button on phone");
  }
} catch (error) {
  console.log("FAILED", error instanceof Error ? error.message : String(error));
  await pageA.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-paste-host-fail.png",
    fullPage: true,
  });
  await pageB.screenshot({
    path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-paste-phone-fail.png",
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await browser.close();
}
