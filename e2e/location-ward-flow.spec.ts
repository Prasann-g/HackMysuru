// e2e/location-ward-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Citizen GPS & Ward Detection Flow', () => {
  test('GPS Capture detects Ward 1 (Hebbalu Lakshmikanthanagar) via authentic 65-ward GeoJSON', async ({ browser }) => {
    // Create browser context with mocked GPS coordinates (Ward 1 centroid)
    const context = await browser.newContext({
      geolocation: { latitude: 12.349695, longitude: 76.609568 },
      permissions: ['geolocation'],
    });

    const page = await context.newPage();

    // 1. Navigate to home
    await page.goto('http://localhost:5173');
    await expect(page).toHaveURL(/localhost:5173/);

    // 2. Open login modal or register citizen
    const loginBtn = page.getByRole('button', { name: 'Log In' }).first();
    await loginBtn.click();

    // Fill in citizen registration or login
    const registerTab = page.getByRole('button', { name: 'Register' });
    await registerTab.click();

    const uniqueEmail = `test.e2e.${Date.now()}@mysuru.test`;
    await page.locator('#auth-name').fill('Mysuru Resident Test');
    await page.locator('#auth-email').fill(uniqueEmail);
    await page.locator('#auth-password').fill('password123');
    await page.getByRole('button', { name: 'Create Citizen Account' }).click();

    // 3. User is logged in, now click "Report Grievance" or "Report a Civic Issue"
    const reportBtn = page.getByRole('button', { name: /Report Grievance|Report a Civic Issue/i }).first();
    await expect(reportBtn).toBeVisible({ timeout: 10000 });
    await reportBtn.click();

    // 4. Step 1: Category Selection
    const potholeCategory = page.getByRole('radio', { name: /Pothole/i });
    await expect(potholeCategory).toBeVisible({ timeout: 10000 });
    await potholeCategory.click();

    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await continueBtn.click();

    // 5. Step 2: Description
    const descInput = page.locator('textarea');
    await expect(descInput).toBeVisible({ timeout: 5000 });
    await descInput.fill('Deep broken road surface near Hebbalu main junction creating traffic congestion.');

    await continueBtn.click();

    // 6. Step 3: Location & GPS Capture
    const useLocationBtn = page.getByRole('button', { name: /Use My Location/i });
    await expect(useLocationBtn).toBeVisible({ timeout: 10000 });
    await useLocationBtn.click();

    // 7. Verify GPS capture confirmation
    await expect(page.getByText(/Location detected/i)).toBeVisible({ timeout: 10000 });

    // 8. Verify authentic Ward 1 resolution
    await expect(page.getByText(/Ward 1 — Hebbalu Lakshmikanthanagar/i)).toBeVisible({ timeout: 10000 });

    // 9. Take screenshot as proof
    await page.screenshot({ path: 'e2e/screenshots/ward1-gps-detected.png' });

    await context.close();
  });
});
