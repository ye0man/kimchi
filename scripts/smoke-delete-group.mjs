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
await page.locator("#group-name").fill("Delete smoke");
await page.getByRole("button", { name: /^Create group$/i }).click();
await page.waitForTimeout(9000);
console.log("GROUP URL:", page.url());

if (
  await page
    .getByText(/Share this table/i)
    .isVisible()
    .catch(() => false)
) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

await page.getByRole("button", { name: "Group options" }).click();
await page.getByRole("menuitem", { name: /Delete group/i }).click();
await page.waitForTimeout(600);
const dialogText = await page.locator("body").innerText();
console.log("DIALOG HAS TITLE:", dialogText.includes("Delete this group?"));
console.log("NO TAB NOTICE:", dialogText.includes("There is no open tab"));
console.log(
  "CANCEL PRESENT:",
  await page
    .getByRole("button", { name: /Keep group open/i })
    .isVisible()
    .catch(() => false),
);

await page.getByRole("button", { name: /Keep group open/i }).click();
await page.waitForTimeout(500);
console.log(
  "DIALOG CLOSED:",
  !(await page
    .getByText(/Delete this group\?/i)
    .isVisible()
    .catch(() => false)),
);

await page.getByRole("button", { name: "Group options" }).click();
await page.getByRole("menuitem", { name: /Delete group/i }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /^Delete group$/i }).click();
await page.waitForTimeout(30000);
console.log("AFTER DELETE URL:", page.url());
const after = await page.locator("body").innerText();
console.log("AFTER DELETE TEXT:", after.slice(0, 700));
console.log("GROUP GONE:", !after.includes("Delete smoke"));
console.log("ERRORS:", JSON.stringify(errors.slice(0, 8)));
await page.screenshot({
  path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-delete.png",
  fullPage: true,
});
await browser.close();
