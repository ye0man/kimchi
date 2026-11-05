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

await page
  .getByRole("button", { name: /New group/i })
  .first()
  .click();
await page.locator("#group-name").fill("Mint check");
await page.getByRole("button", { name: /^Create group$/i }).click();
await page.waitForTimeout(9000);
if (
  await page
    .getByText(/Share this table/i)
    .isVisible()
    .catch(() => false)
) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

const groupUrl = page.url();
await page.goto(`${groupUrl.replace(/\/$/, "")}/kimchi`, {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(6000);
const text = await page.locator("body").innerText();
console.log("TAB PAGE:", text.slice(0, 500));
console.log("NUT-11 BADGE:", text.includes("NUT-11 P2PK"));
console.log("NUT-07 BADGE:", text.includes("NUT-07"));
console.log("NUT-18 BADGE:", text.includes("NUT-18"));
console.log("ERRORS:", JSON.stringify(errors.slice(0, 6)));
await browser.close();
