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

const accounts = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("accounts") || "[]"),
);
const pubkey = accounts[0]?.pubkey;
console.log("PUBKEY:", pubkey?.slice(0, 12));

await page.goto(`${url}/settings/profile`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const labels = await page
  .locator('svg[role="img"]')
  .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
console.log("MASCOT LABELS:", JSON.stringify(labels));

const recent = {
  pubkey: "c".repeat(64),
  lastSeen: Date.now(),
  groups: ["group-1"],
  saved: false,
};
await page.evaluate(
  ({ pubkey, recent }) => {
    localStorage.setItem(
      `kimchi:contacts:v1:${pubkey}`,
      JSON.stringify([recent]),
    );
  },
  { pubkey, recent },
);
await page.goto(`${url}/contacts`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
console.log(
  "CONTACTS:",
  (await page.locator("body").innerText()).slice(0, 350),
);

const keep = page.getByRole("button", { name: /Keep/i }).first();
console.log("KEEP VISIBLE:", await keep.isVisible().catch(() => false));
if (await keep.isVisible().catch(() => false)) {
  await keep.click();
  await page.waitForTimeout(700);
}
console.log(
  "AFTER KEEP:",
  (await page.locator("body").innerText()).slice(0, 350),
);

const older = {
  pubkey: "d".repeat(64),
  lastSeen: Date.now() - 2 * 86_400_000,
  groups: [],
  saved: false,
};
await page.evaluate(
  ({ pubkey, older }) => {
    const key = `kimchi:contacts:v1:${pubkey}`;
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    list.push(older);
    localStorage.setItem(key, JSON.stringify(list));
  },
  { pubkey, older },
);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const afterPrune = await page.locator("body").innerText();
console.log("AFTER PRUNE:", afterPrune.slice(0, 350));
console.log("OLD CONTACT PRUNED:", !afterPrune.includes("dddddddddddd"));
console.log("ERRORS:", JSON.stringify(errors.slice(0, 6)));
await page.screenshot({
  path: "C:\\Users\\jakey\\AppData\\Local\\Temp\\opencode\\kimchi-contacts.png",
  fullPage: true,
});
await browser.close();
