import { runTest } from "./auth";

runTest("Manual structure flow", async (helper) => {
  const { page } = helper;

  await helper.goto("/dashboard");
  await page.waitForTimeout(2000);

  const composer = page.locator("textarea").first();
  await composer.waitFor({ state: "visible", timeout: 10000 });
  await composer.fill("Aplikasi kasir sederhana untuk warung kopi");
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Bikin PRD/i }).click();
  await page.waitForURL(/\/project\//, { timeout: 15000 });

  // Choose manual
  await page
    .getByRole("heading", { name: /Bagaimana mau menyusun struktur/i })
    .waitFor({ state: "visible", timeout: 15000 });
  await page.getByRole("button", { name: /Susun manual/i }).click();

  // Editable empty structure -> add a feature
  await page
    .getByRole("heading", { name: /^Struktur fitur$/i })
    .waitFor({ state: "visible", timeout: 15000 });
  await page.getByRole("button", { name: /Tambah fitur/i }).click();
  await page.waitForTimeout(500);
  await helper.screenshot("manual-editing.png");

  // The map should now render a feature node + sub-feature card
  const subVisible = await page
    .locator("text=Sub fitur")
    .first()
    .isVisible()
    .catch(() => false);
  if (!subVisible) throw new Error("Editor manual tidak menampilkan sub fitur");

  // Add a sub-feature via the "Sub" button
  await page.getByRole("button", { name: /^Sub$/i }).first().click();
  await page.waitForTimeout(300);

  // Save
  await page.getByRole("button", { name: /^Simpan$/i }).click();
  await page.waitForTimeout(1000);
  await helper.screenshot("manual-saved.png");

  // Continue to PRD -> should reach the questions step
  await page.getByRole("button", { name: /Lanjut ke PRD/i }).click();
  await page
    .getByRole("heading", { name: /Beberapa pertanyaan dulu/i })
    .waitFor({ state: "visible", timeout: 90000 });
  await helper.screenshot("manual-questions.png");

  console.log("Manual structure flow test passed");
}).catch(() => process.exit(1));
