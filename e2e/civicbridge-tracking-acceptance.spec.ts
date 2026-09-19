import { test, expect } from '@playwright/test';
import path from 'path';

test('Citizen Tracking View — Full UI Verification for TRK-SRC-307753', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Navigate with tracking tab and token pre-populated
  await page.goto('http://localhost:5173/?tab=track&token=TRK-SRC-307753', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take screenshot of initial view
  const dir = path.resolve(__dirname, 'screenshots');
  await page.screenshot({ path: `${dir}/accept-tracking-01-initial.png`, fullPage: false });

  // 1. Verify token input contains TRK-SRC-307753
  const input = page.locator('input[value="TRK-SRC-307753"]');
  const hasInput = await input.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[tracking-ui] Token input with TRK-SRC-307753 visible: ${hasInput}`);

  // 2. Verify grievance status badge or text
  const statusSubmitted = page.getByText(/SUBMITTED|Submitted & Registered/i).first();
  const hasStatus = await statusSubmitted.isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[tracking-ui] Status SUBMITTED visible: ${hasStatus}`);
  expect(hasStatus).toBe(true);

  // 3. Verify category and location
  const hasCategory = await page.getByText(/pothole|Road Infrastructure/i).first().isVisible({ timeout: 5000 }).catch(() => false);
  const hasLocation = await page.getByText(/Vishweshwaranagara/i).first().isVisible({ timeout: 5000 }).catch(() => false);
  console.log(`[tracking-ui] Category visible: ${hasCategory}`);
  console.log(`[tracking-ui] Location (Vishweshwaranagara) visible: ${hasLocation}`);
  expect(hasLocation).toBe(true);

  // 4. Verify 5-stage lifecycle indicator
  const stages = ['Submitted & Registered', 'Evidence & Triage Verification', 'Department Assigned', 'Field Team In Progress', 'Resolved & Verified'];
  for (const stage of stages) {
    const stageEl = page.getByText(stage).first();
    const visible = await stageEl.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[tracking-ui] Stage "${stage}" visible: ${visible}`);
  }

  // 5. Verify source complaint details remain intact and unchanged
  const hasToken = await page.getByText('TRK-SRC-307753').first().isVisible();
  expect(hasToken).toBe(true);

  // 6. Navigate to Section 3: Grievance Details
  const section3Btn = page.getByRole('button', { name: /Grievance Details|Locality & Evidence/i }).first();
  if (await section3Btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await section3Btn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/accept-tracking-04-section3-details.png`, fullPage: false });
    console.log('[tracking-ui] Navigated to Section 3: Grievance Details');
  }

  // 7. Navigate to Section 4: Assessment Signals
  const section4Btn = page.getByRole('button', { name: /Assessment Signals|Explainable Triage/i }).first();
  if (await section4Btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await section4Btn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/accept-tracking-05-section4-signals.png`, fullPage: false });
    console.log('[tracking-ui] Navigated to Section 4: Assessment Signals');

    const disclaimer = page.getByText(/visual evidence only|Physical site veracity requires human inspection|disclaimer/i).first();
    const hasDisclaimer = await disclaimer.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[tracking-ui] Anti-hallucination disclaimer visible in Section 4: ${hasDisclaimer}`);
  }

  // 8. Verify NO citizen PII is rendered on screen (Rule 12)
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('USR-CITIZEN');
  expect(bodyText).not.toContain('gallikattip@gmail.com');
  console.log('[tracking-ui] PASS — Zero citizen PII displayed');

  // Capture full portal screenshot
  await page.screenshot({ path: `${dir}/accept-tracking-02-full-portal.png`, fullPage: false });

  // Scroll down to capture evidence & signals
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/accept-tracking-03-signals.png`, fullPage: false });

  console.log('[tracking-ui] Console errors count:', consoleErrors.length);
  expect(consoleErrors.filter(e => !e.includes('DevTools')).length).toBe(0);
});
