import { runTest } from "./auth";

runTest("PRD generation flow", async (helper) => {
  const { page } = helper;

  // Start on dashboard (already authenticated)
  await helper.goto("/dashboard");
  await page.waitForTimeout(2000);

  // Composer should be visible
  const composer = page.locator("textarea").first();
  await composer.waitFor({ state: "visible", timeout: 10000 });
  await composer.fill(
    "Aplikasi web untuk mencatat kebiasaan harian (habit tracker) dengan reminder dan statistik streak",
  );
  await page.waitForTimeout(500);

  // Click "Bikin PRD" -> creates draft (status "choosing")
  await page.getByRole("button", { name: /Bikin PRD/i }).click();
  await page.waitForURL(/\/project\//, { timeout: 15000 });

  // --- Struktur step: choose AI ---
  await page
    .getByRole("heading", { name: /Bagaimana mau menyusun struktur/i })
    .waitFor({ state: "visible", timeout: 15000 });
  await helper.screenshot("prd-choose.png");
  await page.getByRole("button", { name: /Generate dengan AI/i }).click();

  // Wait for the AI-built structure map
  await page
    .getByRole("heading", { name: /^Struktur fitur$/i })
    .waitFor({ state: "visible", timeout: 90000 });
  await page.waitForTimeout(1500);
  const subVisible = await page
    .locator("text=Sub fitur")
    .first()
    .isVisible()
    .catch(() => false);
  if (!subVisible) throw new Error("Peta struktur (sub fitur) tidak muncul");
  await helper.screenshot("prd-structure.png");

  // Continue to PRD
  await page.getByRole("button", { name: /Lanjut ke PRD/i }).click();

  // --- Questions step ---
  await page
    .getByRole("heading", { name: /Beberapa pertanyaan dulu/i })
    .waitFor({ state: "visible", timeout: 90000 });
  await page.waitForTimeout(1000);
  await helper.screenshot("prd-questions.png");

  // Answer the questions (fill every textarea in the form)
  const answerBoxes = page.locator("textarea");
  const count = await answerBoxes.count();
  if (count === 0) throw new Error("Tidak ada pertanyaan yang muncul");
  for (let i = 0; i < count; i++) {
    await answerBoxes
      .nth(i)
      .fill(
        "Target pengguna individu produktif; MVP fokus di web; budget kecil; kerjakan bertahap mulai auth lalu tracking lalu statistik.",
      );
  }
  await page.waitForTimeout(500);

  // Submit answers -> builds the PRD
  await page.getByRole("button", { name: /Bikin PRD/i }).click();
  await page.waitForTimeout(1500);
  await helper.screenshot("prd-generating.png");

  // Wait for generation to finish (AI smart can take a while)
  const tabs = page.getByRole("tab", { name: /Fitur/i });
  await tabs.waitFor({ state: "visible", timeout: 120000 });
  await page.waitForTimeout(1500);
  await helper.screenshot("prd-overview.png");

  // Verify overview content exists
  const hasSummary = await page.locator("text=Ringkasan").first().isVisible();
  if (!hasSummary) throw new Error("Ringkasan tidak muncul di tab PRD");

  // Struktur tab should be present in the ready view
  const structTab = page.getByRole("tab", { name: /Struktur/i });
  const structTabVisible = await structTab.isVisible().catch(() => false);
  if (!structTabVisible) throw new Error("Tab Struktur tidak muncul di PRD siap");
  await structTab.click();
  await page.waitForTimeout(1200);
  await helper.screenshot("prd-structure-tab.png");

  // Open Fitur tab
  await tabs.click();
  await page.waitForTimeout(1500);
  const specVisible = await page
    .locator("text=Spec")
    .first()
    .isVisible()
    .catch(() => false);
  if (!specVisible) throw new Error("Spec fitur tidak muncul");
  await helper.screenshot("prd-features.png");

  console.log("PRD flow test passed");
}).catch(() => process.exit(1));
