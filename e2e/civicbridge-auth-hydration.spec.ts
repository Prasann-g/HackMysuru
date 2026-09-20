import { test, expect } from '@playwright/test';

const mockOfficer = {
  id: 'USR-OFFICER-48',
  name: 'Ward 48 Zonal Officer',
  email: 'officer.ward48@mcc.gov.in',
  role: 'OFFICER',
  department: 'MCC Engineering Division',
  ward: 'Ward 48 - Kuvempunagar',
  isActive: true,
};

const mockCitizen = {
  id: 'USR-CITIZEN-TEST',
  name: 'Mysuru Citizen',
  email: 'citizen.test@gmail.com',
  role: 'CITIZEN',
  ward: 'Ward 48 - Kuvempunagar',
  isActive: true,
};

test.describe('CivicBridge Phase 3.3.2: Auth Hydration & Dashboard Flash Prevention', () => {
  test('1. Shows clean CivicBridge loading screen while /api/auth/me is verifying and does not render dashboards', async ({ page }) => {
    // Intercept /api/auth/me with deliberate delay to inspect the hydration state
    await page.route('**/api/auth/me', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockOfficer }),
      });
    });

    // Mock officer complaints endpoint so dashboard can load after hydration
    await page.route('**/api/officer/complaints*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ complaints: [] }),
      });
    });

    // Seed valid token
    await page.addInitScript((officer) => {
      sessionStorage.setItem('civictrust_token', 'valid-officer-token');
      sessionStorage.setItem('civictrust_citizen_user', JSON.stringify(officer));
    }, mockOfficer);

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

    // While hydration is in progress, the loading screen must be active
    const loadingScreen = page.locator('[role="status"][aria-label="Verifying CivicBridge authentication"]');
    await expect(loadingScreen).toBeVisible();
    await expect(page.getByText('Verifying Session')).toBeVisible();
    await expect(page.getByText('Authenticating municipal credentials with Mysuru City Corporation...')).toBeVisible();

    // While hydrating, neither OfficerDashboard nor CitizenDashboard nor LandingPage should be visible
    await expect(page.locator('h1:has-text("Citizen Grievance Workspace")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Report Municipal Grievance")')).not.toBeVisible();

    // After /api/auth/me finishes (800ms), loading screen unmounts and Officer dashboard renders
    await expect(loadingScreen).not.toBeVisible({ timeout: 5000 });
    const officerConsole = page.locator('text=MCC Grievance Verification & Review Console').first();
    await expect(officerConsole).toBeVisible();
  });

  test('2. Authoritative /api/auth/me overrides stale cached role without flashing prior wrong dashboard', async ({ page }) => {
    // Backend returns OFFICER, but cached session previously held CITIZEN
    await page.route('**/api/auth/me', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockOfficer }),
      });
    });

    await page.route('**/api/officer/complaints*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ complaints: [] }),
      });
    });

    // Seed token with a stale CITIZEN session in storage
    await page.addInitScript((citizen) => {
      sessionStorage.setItem('civictrust_token', 'stale-role-token');
      sessionStorage.setItem('civictrust_citizen_user', JSON.stringify(citizen));
    }, mockCitizen);

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

    // Loading screen shows during verification
    const loadingScreen = page.locator('[role="status"][aria-label="Verifying CivicBridge authentication"]');
    await expect(loadingScreen).toBeVisible();

    // Once verification resolves, authoritative OFFICER console must render
    await expect(loadingScreen).not.toBeVisible({ timeout: 5000 });
    const officerConsole = page.locator('text=MCC Grievance Verification & Review Console').first();
    await expect(officerConsole).toBeVisible();

    // Verify sessionStorage was updated with authoritative user from /api/auth/me
    const storedUser = await page.evaluate(() => {
      const val = sessionStorage.getItem('civictrust_citizen_user');
      return val ? JSON.parse(val) : null;
    });
    expect(storedUser?.role).toBe('OFFICER');
    expect(storedUser?.email).toBe('officer.ward48@mcc.gov.in');
  });

  test('3. Invalid token or 401 on /api/auth/me evicts session and shows public landing page', async ({ page }) => {
    // Intercept /api/auth/me returning 401 Unauthorized
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session expired or invalid token' }),
      });
    });

    // Seed invalid token and expired cached user
    await page.addInitScript((officer) => {
      sessionStorage.setItem('civictrust_token', 'expired-bad-token');
      sessionStorage.setItem('civictrust_citizen_user', JSON.stringify(officer));
    }, mockOfficer);

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

    // Wait for hydration to complete and safe fallback to landing page
    await expect(page.locator('[role="status"][aria-label="Verifying CivicBridge authentication"]')).not.toBeVisible({ timeout: 5000 });

    // Verify public landing page renders with guest Log In button
    const loginButton = page.locator('button', { hasText: 'Log In' }).first();
    await expect(loginButton).toBeVisible();

    // Verify tokens were completely wiped from sessionStorage
    const token = await page.evaluate(() => sessionStorage.getItem('civictrust_token'));
    const user = await page.evaluate(() => sessionStorage.getItem('civictrust_citizen_user'));
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  test('4. Guest with no stored token renders public landing page immediately without hydration screen', async ({ page }) => {
    // Ensure clean storage
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

    // Loading screen should NOT be shown
    const loadingScreen = page.locator('[role="status"][aria-label="Verifying CivicBridge authentication"]');
    await expect(loadingScreen).not.toBeVisible();

    // Public landing page is immediately visible
    const loginButton = page.locator('button', { hasText: 'Log In' }).first();
    await expect(loginButton).toBeVisible();
  });

  test('5. Authenticated ADMIN user hydrates to OfficerDashboard with MCC Administrator Console', async ({ page }) => {
    const mockAdmin = {
      id: 'USR-ADMIN-01',
      name: 'Commissioner Admin',
      email: 'commissioner@mcc.gov.in',
      role: 'ADMIN',
      isActive: true,
    };

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockAdmin }),
      });
    });

    await page.route('**/api/officer/complaints*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ complaints: [] }),
      });
    });

    await page.addInitScript((admin) => {
      sessionStorage.setItem('civictrust_token', 'valid-admin-token');
      sessionStorage.setItem('civictrust_citizen_user', JSON.stringify(admin));
    }, mockAdmin);

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

    // Wait for hydration to complete
    await expect(page.locator('[role="status"][aria-label="Verifying CivicBridge authentication"]')).not.toBeVisible({ timeout: 5000 });

    // Verify OfficerDashboard renders with MCC ADMINISTRATOR badge
    await expect(page.getByText('MCC ADMINISTRATOR', { exact: true })).toBeVisible();
    await expect(page.getByText('MCC Administrator Console')).toBeVisible();

    // Verify citizen actions are NOT visible
    await expect(page.locator('button:has-text("Report Issue")')).not.toBeVisible();
    await expect(page.locator('button:has-text("My Complaints")')).not.toBeVisible();
  });
});
