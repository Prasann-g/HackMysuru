// e2e/officer-dashboard.spec.ts
import { test, expect } from '@playwright/test';

// Helper to capture console logs and network failures
let consoleMessages: string[] = [];
let requestFailures: string[] = [];

test.describe('Officer Dashboard E2E Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console logs
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });
    // Capture failed requests
    page.on('requestfailed', request => {
      requestFailures.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });
    // Navigate to the client app
    await page.goto('http://localhost:5173');
    // Ensure the page loaded
    await expect(page).toHaveURL(/localhost:5173/);
    // Take initial screenshot
    await page.screenshot({ path: 'e2e/screenshots/00-home.png' });
  });

  test('Full officer workflow', async ({ page }) => {
    // 1. Open Officer login tab
    await page.getByRole('button', { name: 'MCC Officer' }).click();
    await page.screenshot({ path: 'e2e/screenshots/01-officer-tab.png' });

    // 2. Use demo officer fill button
    await page.getByRole('button', { name: /Use Demo Officer/ }).click();
    // Click Log In
    await page.getByRole('button', { name: /Log In as MCC Officer/ }).click();
    // Wait for navigation to officer dashboard (a heading or unique element)
    const dashboardHeader = page.getByRole('heading', { name: /Officer Dashboard/i });
    await expect(dashboardHeader).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'e2e/screenshots/02-dashboard.png' });

    // 3. Verify at least one complaint row is present
    const complaintRows = page.locator('[data-test-id="complaint-row"]');
    await expect(complaintRows.first()).toBeVisible();
    const firstRow = complaintRows.first();
    // Capture its ID for later verification
    const complaintId = await firstRow.getAttribute('data-complaint-id');
    // 4. Open the complaint detail drawer
    await firstRow.click();
    await page.screenshot({ path: 'e2e/screenshots/03-drawer-open.png' });

    // 5. Verify citizen information only visible to officer
    const citizenInfo = page.locator('[data-test-id="citizen-info"]');
    await expect(citizenInfo).toBeVisible();

    // 6. Verify evidence image loads (if present)
    // Wait for either the image or the "No Photo" text
    const image = page.locator('img[data-test-id="evidence-image"]').first();
    const noPhoto = page.getByText('No Photographic Evidence Attached').first();
    await Promise.race([
      expect(image).toBeVisible({ timeout: 10000 }),
      expect(noPhoto).toBeVisible({ timeout: 10000 })
    ]);
    if (await image.isVisible()) {
      // Image is loaded
    } else {
      // Fallback placeholder
      const placeholder = page.getByText('No Photographic Evidence Attached').first();
      await expect(placeholder).toBeVisible();
    }
    await page.screenshot({ path: 'e2e/screenshots/04-evidence.png' });

    // 7. Test image enlargement modal if image exists
    const enlargeBtn = page.getByRole('button', { name: /Enlarge/i });
    if (await enlargeBtn.count()) {
      await enlargeBtn.first().click();
      const modalImg = page.locator('img[data-test-id="enlarged-image"]');
      await expect(modalImg).toBeVisible();
      await page.screenshot({ path: 'e2e/screenshots/05-enlarged.png' });
      // Close modal
      await page.getByRole('button', { name: /Close/i }).click();
    }

    // 8. Duplicate / Distinct candidate actions
    const confirmDupBtn = page.getByRole('button', { name: /Confirm Duplicate/i });
    const markDistinctBtn = page.getByRole('button', { name: /Mark Distinct/i });
    if (await confirmDupBtn.count()) {
      await confirmDupBtn.first().click();
      // Verify prefilled note
      const notesArea = page.getByLabel(/Review notes/i);
      await expect(notesArea).toHaveValue(/DUPLICATE ACTION/i);
      await page.screenshot({ path: 'e2e/screenshots/06-duplicate-prefill.png' });
    }
    if (await markDistinctBtn.count()) {
      await markDistinctBtn.first().click();
      const notesArea = page.getByLabel(/Review notes/i);
      await expect(notesArea).toHaveValue(/DISTINCT ACTION/i);
      await page.screenshot({ path: 'e2e/screenshots/07-distinct-prefill.png' });
    }

    // 9. Submit a review action (pick first available status)
    const statusSelect = page.getByLabel('Review Status');
    await statusSelect.selectOption({ value: 'UNDER_REVIEW' });
    const saveBtn = page.getByRole('button', { name: /Save Review/i });
    // Intercept PATCH request
    const [patchResponse] = await Promise.all([
      page.waitForResponse(resp => resp.request().method() === 'PATCH' && resp.url().includes('/api/officer/complaints/') && resp.status() === 200),
      saveBtn.click()
    ]);
    expect(patchResponse.status()).toBe(200);
    await page.screenshot({ path: 'e2e/screenshots/08-review-saved.png' });

    // 10. Verify dashboard refreshes
    await page.getByLabel('Close drawer').click();
    await expect(page.locator('[data-test-id="complaint-drawer"]')).toBeHidden();
    const rowsAfter = await page.locator('[data-test-id="complaint-row"]').count();
    expect(rowsAfter).toBeGreaterThanOrEqual(1);
    await page.screenshot({ path: 'e2e/screenshots/09-dashboard-refresh.png' });
  });

  test('Unauthorized access checks', async ({ request }) => {
    const resp = await request.get('http://localhost:5000/api/officer/complaints');
    expect(resp.status()).toBe(401);
    const imageResp = await request.get('http://localhost:5000/api/complaints/1/image');
    expect([401, 403]).toContain(imageResp.status());
  });

  test.afterAll(async () => {
    const fs = require('fs');
    fs.writeFileSync('e2e/console.log', consoleMessages.join('\n'));
    fs.writeFileSync('e2e/network-failures.log', requestFailures.join('\n'));
  });
});
