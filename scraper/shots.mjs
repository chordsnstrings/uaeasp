import { chromium } from "playwright";
const out = "/tmp/claude-0/-home-user-uaeasp/7d71e3f1-590b-5a0e-9ada-ec87128079e2/scratchpad";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();

const shots = [
  ["http://localhost:3100/", "home-en.png", true],
  ["http://localhost:3100/ar", "home-ar.png", false],
  ["http://localhost:3100/providers", "providers.png", false],
  ["http://localhost:3100/assessment", "assessment.png", false],
  ["http://localhost:3100/get-matched", "get-matched.png", true],
];
for (const [url, name, full] of shots) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${name}`, fullPage: full });
}

// Admin: login and shoot dashboard
await page.goto("http://localhost:3100/admin/login", { waitUntil: "networkidle" });
await page.fill("#email", "admin@test.ae");
await page.fill("#password", "adminpass123");
await page.click("button[type=submit]");
await page.waitForURL("**/admin", { timeout: 15000 }).catch(() => {});
await page.goto("http://localhost:3100/admin", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/admin-dashboard.png`, fullPage: true });
await browser.close();
console.log("done");
