import { test, expect } from '@playwright/test';

const mockOfficer = {
  id: 'USR-OFFICER-TEST',
  name: 'Ward 48 Zonal Officer',
  email: 'officer.ward48@mcc.gov.in',
  role: 'OFFICER',
  department: 'MCC Engineering Division',
  ward: 'Ward 48 - Kuvempunagar',
  isActive: true,
};

test.describe('CivicBridge Phase 3.3.1: 401 Session Eviction & Route Protection', () => {
  test.beforeEach(async ({ page }) => {
    // Mock /api/auth/me for officer authentication
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockOfficer }),
      });
    });
  });

  test('401 response on authenticated request evicts session and resets UI to landing view', async ({ page }) => {
    // Intercept officer complaints to simulate token expiration (401)
    await page.route('**/api/officer/complaints*', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session expired or token invalid.' }),
      });
    });

    // Seed valid session before page loads
    await page.addInitScript((officer) => {
      sessionStorage.setItem('civictrust_token', 'mock-expired-token');
      sessionStorage.setItem('civictrust_citizen_user', JSON.stringify(officer));
      (window as any).__unauthorizedEventFired = false;
      window.addEventListener('civictrust:unauthorized', () => {
        (window as any).__unauthorizedEventFired = true;
      });
    }, mockOfficer);

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Verify event fired in browser
    const eventFired = await page.evaluate(() => (window as any).__unauthorizedEventFired);
    expect(eventFired).toBe(true);

    // Verify session storage was evicted
    const token = await page.evaluate(() => sessionStorage.getItem('civictrust_token'));
    const user = await page.evaluate(() => sessionStorage.getItem('civictrust_citizen_user'));
    expect(token).toBeNull();
    expect(user).toBeNull();

    // Verify UI reset to public landing page
    const loginButton = page.locator('button', { hasText: 'Log In' }).first();
    await expect(loginButton).toBeVisible();
  });

  test('403 Forbidden response preserves session and does NOT trigger unauthorized eviction', async ({ page }) => {
    // Mock officer complaints returning 403 Forbidden
    await page.route('**/api/officer/complaints*', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Access denied: insufficient permissions.' }),
      });
    });

    // Seed valid session before page loads
    await page.addInitScript((officer) => {
      sessionStorage.setItem('civictrust_token', 'valid-officer-token');
      sessionStorage.setItem('civictrust_citizen_user', JSON.stringify(officer));
      (window as any).__unauthorizedEventFired = false;
      window.addEventListener('civictrust:unauthorized', () => {
        (window as any).__unauthorizedEventFired = true;
      });
    }, mockOfficer);

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Verify unauthorized event was NOT fired
    const eventFired = await page.evaluate(() => (window as any).__unauthorizedEventFired);
    expect(eventFired).toBe(false);

    // Verify session storage remains intact
    const token = await page.evaluate(() => sessionStorage.getItem('civictrust_token'));
    const user = await page.evaluate(() => sessionStorage.getItem('civictrust_citizen_user'));
    expect(token).toBe('valid-officer-token');
    expect(user).not.toBeNull();
  });

  test('Manual logout clears session tokens and returns to public landing view', async ({ page }) => {
    // Intercept complaints with empty list
    await page.route('**/api/officer/complaints*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ complaints: [], total: 0 }),
      });
    });

    // Seed session
    await page.addInitScript((officer) => {
      sessionStorage.setItem('civictrust_token', 'active-token');
      sessionStorage.setItem('civictrust_citizen_user', JSON.stringify(officer));
    }, mockOfficer);

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Open profile menu
    const accountBtn = page.locator('button[aria-label="Account menu"]');
    await accountBtn.click();

    // Click Log Out
    const logoutBtn = page.locator('button', { hasText: 'Log Out' });
    await logoutBtn.click();
    await page.waitForTimeout(500);

    // Verify session storage was cleared
    const token = await page.evaluate(() => sessionStorage.getItem('civictrust_token'));
    const user = await page.evaluate(() => sessionStorage.getItem('civictrust_citizen_user'));
    expect(token).toBeNull();
    expect(user).toBeNull();

    // Verify public landing view is rendered
    const trackBtn = page.locator('button', { hasText: 'Track Complaint' }).first();
    await expect(trackBtn).toBeVisible();
  });
});
