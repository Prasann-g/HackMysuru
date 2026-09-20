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
  name: 'Prasann Gallikatti',
  email: 'citizen.test@gmail.com',
  role: 'CITIZEN',
  ward: 'Ward 48 - Kuvempunagar',
  isActive: true,
};

test.describe('CivicBridge Phase 3.3.3: MCC Officer Login Redesign', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure clean storage for unauthenticated tests
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
  });

  test('1. Officer portal displays official municipal branding and is visually distinct with no signup options', async ({ page }) => {
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

    // Click "MCC Officer" button in Navbar
    const officerNavBtn = page.locator('button', { hasText: 'MCC Officer' }).first();
    await expect(officerNavBtn).toBeVisible();
    await officerNavBtn.click();

    // Verify official Officer Portal modal is open
    const modalTitle = page.locator('#officer-portal-title');
    await expect(modalTitle).toBeVisible();
    await expect(modalTitle).toHaveText('MCC Officer Portal');

    // Verify official municipal badge & security advisory
    await expect(page.locator('text=MCC INTERNAL SYSTEMS')).toBeVisible();
    await expect(page.locator('text=Restricted Access')).toBeVisible();
    await expect(page.locator('text=Authorized Personnel Authentication')).toBeVisible();

    // Verify form fields
    await expect(page.locator('label', { hasText: 'Official MCC Email / ID' })).toBeVisible();
    await expect(page.locator('#officer-email')).toHaveAttribute('placeholder', 'officer.ward48@mcc.gov.in');
    await expect(page.locator('label', { hasText: 'Security Password' })).toBeVisible();

    // Verify button
    const submitBtn = page.locator('button[type="submit"]', { hasText: 'Sign In to Officer Console' });
    await expect(submitBtn).toBeVisible();

    // Verify NO public signup tabs or links exist inside the officer portal
    const officerModal = page.locator('[role="dialog"]');
    await expect(officerModal.locator('button', { hasText: 'Create Account' })).not.toBeVisible();
    await expect(officerModal.locator('button', { hasText: 'Register' })).not.toBeVisible();

    // Verify Back to Citizen Login link
    await expect(officerModal.locator('button', { hasText: 'Back to Citizen Login' })).toBeVisible();
  });

  test('2. Bidirectional navigation switches smoothly between Citizen Login and MCC Officer Portal', async ({ page }) => {
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

    // Open Citizen Login from Navbar
    await page.locator('button', { hasText: 'Log In' }).first().click();
    await expect(page.locator('#auth-modal-title')).toHaveText('Citizen Sign In');

    // Click "Access MCC Officer Portal" in footer
    const switchToOfficerBtn = page.locator('button', { hasText: 'Access MCC Officer Portal' });
    await expect(switchToOfficerBtn).toBeVisible();
    await switchToOfficerBtn.click();

    // Confirm transition to MCC Officer Portal
    await expect(page.locator('#officer-portal-title')).toHaveText('MCC Officer Portal');

    // Click "Back to Citizen Login"
    const switchToCitizenBtn = page.locator('button', { hasText: 'Back to Citizen Login' });
    await switchToCitizenBtn.click();

    // Confirm transition back to Citizen Sign In
    await expect(page.locator('#auth-modal-title')).toHaveText('Citizen Sign In');
    await expect(page.locator('button', { hasText: 'Citizen Login' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Register' })).toBeVisible();
  });

  test('3. Invalid officer credentials display clear error alert and retain form state', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid officer credentials. Please check your official email and password.' }),
      });
    });

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.locator('button', { hasText: 'MCC Officer' }).first().click();

    await page.fill('#officer-email', 'officer.ward48@mcc.gov.in');
    await page.fill('#officer-password', 'wrong-pass');
    await page.locator('button[type="submit"]', { hasText: 'Sign In to Officer Console' }).click();

    // Verify error alert appears
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Invalid officer credentials');

    // Verify modal remains open
    await expect(page.locator('#officer-portal-title')).toBeVisible();
  });

  test('4. RBAC Gate: Citizen credentials used in Officer Portal are denied access to Officer Console', async ({ page }) => {
    // Simulate backend accepting password but returning role: 'CITIZEN'
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-citizen-token',
          user: mockCitizen,
        }),
      });
    });

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.locator('button', { hasText: 'MCC Officer' }).first().click();

    await page.fill('#officer-email', 'citizen.test@gmail.com');
    await page.fill('#officer-password', 'citizenpassword123');
    await page.locator('button[type="submit"]', { hasText: 'Sign In to Officer Console' }).click();

    // Verify access denied message
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Access restricted to verified MCC Officers');

    // Verify token was purged and not stored
    const token = await page.evaluate(() => sessionStorage.getItem('civictrust_token'));
    expect(token).toBeNull();

    // Verify officer console did NOT open
    await expect(page.locator('text=MCC Grievance Verification & Review Console')).not.toBeVisible();
  });

  test('5. Valid officer credentials redirect directly to Officer Console', async ({ page }) => {
    // Mock login endpoint returning valid OFFICER user
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'valid-jwt-officer-token',
          user: mockOfficer,
        }),
      });
    });

    // Mock officer complaints endpoint
    await page.route('**/api/officer/complaints*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ complaints: [] }),
      });
    });

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.locator('button', { hasText: 'MCC Officer' }).first().click();

    await page.fill('#officer-email', 'officer.ward48@mcc.gov.in');
    await page.fill('#officer-password', 'correct-officer-password');
    await page.locator('button[type="submit"]', { hasText: 'Sign In to Officer Console' }).click();

    // Verify modal closes and Officer Console is rendered
    await expect(page.locator('#officer-portal-title')).not.toBeVisible();
    const officerConsole = page.locator('text=MCC Grievance Verification & Review Console').first();
    await expect(officerConsole).toBeVisible();

    // Verify officer session was stored in sessionStorage
    const token = await page.evaluate(() => sessionStorage.getItem('civictrust_token'));
    const user = await page.evaluate(() => {
      const val = sessionStorage.getItem('civictrust_citizen_user');
      return val ? JSON.parse(val) : null;
    });
    expect(token).toBe('valid-jwt-officer-token');
    expect(user?.role).toBe('OFFICER');
    expect(user?.name).toBe('Ward 48 Zonal Officer');
  });

  test('6. Citizen login and signup experience remains fully preserved and functional', async ({ page }) => {
    // Mock login endpoint returning valid CITIZEN user
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'valid-jwt-citizen-token',
          user: mockCitizen,
        }),
      });
    });

    // Mock citizen complaints endpoint
    await page.route('**/api/complaints/my', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ complaints: [] }),
      });
    });

    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });

    // Open Citizen Login from Navbar
    await page.locator('button', { hasText: 'Log In' }).first().click();
    await expect(page.locator('#auth-modal-title')).toHaveText('Citizen Sign In');

    // Fill citizen login form
    await page.fill('#auth-email', 'citizen.test@gmail.com');
    await page.fill('#auth-password', 'citizenpass123');
    await page.locator('button[type="submit"]', { hasText: 'Log In as Citizen' }).click();

    // Verify Citizen Workspace opens
    await expect(page.locator('#auth-modal-title')).not.toBeVisible();
    await expect(page.locator('text=Mysuru Citizen Portal')).toBeVisible();
    await expect(page.locator('text=Welcome back, Prasann Gallikatti')).toBeVisible();

    // Verify citizen session is saved
    const user = await page.evaluate(() => {
      const val = sessionStorage.getItem('civictrust_citizen_user');
      return val ? JSON.parse(val) : null;
    });
    expect(user?.role).toBe('CITIZEN');
    expect(user?.name).toBe('Prasann Gallikatti');
  });
});
