import { chromium } from "playwright-core";

const url = process.env.KIMCHI_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

await page.goto(`${url}/signin`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /Generate identity/i }).click();
await page.waitForURL("**/groups", { timeout: 20000 });
await page.waitForTimeout(1500);
console.log("SHELL:", (await page.locator("body").innerText()).slice(0, 220));

await page
  .getByRole("button", { name: /New group/i })
  .first()
  .click();
await page.locator("#group-name").fill("Smoke test");
await page.getByRole("button", { name: /^Create group$/i }).click();
await page.waitForTimeout(12000);
console.log("AFTER CREATE URL:", page.url());
const body = await page.locator("body").innerText();
console.log("AFTER CREATE TEXT:", body.slice(0, 400));

await page.screenshot({
  path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-create.png",
  fullPage: true,
});

if (!page.url().includes("/groups/")) {
  console.log("group creation did not navigate; skipping detail checks");
} else {
  const shareVisible = await page
    .getByText(/Share this table/i)
    .isVisible()
    .catch(() => false);
  console.log("SHARE SHEET VISIBLE:", shareVisible);
  if (shareVisible) {
    const link = await page
      .locator("img[alt='QR code']")
      .first()
      .getAttribute("src");
    console.log("SHARE QR PRESENT:", Boolean(link));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }
}

await page.goto(`${url}/contacts`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
console.log(
  "CONTACTS:",
  (await page.locator("body").innerText()).slice(0, 220),
);

await page.goto(`${url}/wallet`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
console.log("WALLET:", (await page.locator("body").innerText()).slice(0, 260));

await page.goto(`${url}/join/not-a-real-code`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(800);
console.log(
  "JOIN-INVALID:",
  (await page.locator("body").innerText()).slice(0, 160),
);

console.log("ERRORS:", JSON.stringify(errors.slice(0, 10)));
await browser.close();
