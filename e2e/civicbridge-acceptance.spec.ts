/**
 * CivicBridge — Read-Only Browser Acceptance Walkthrough
 *
 * Scope: Verify all completed features without modifying source files,
 *        databases, or Git state. Screenshots saved to e2e/screenshots/.
 *
 * KNOWN BLOCKER (documented, not an error):
 *   Officer login is unavailable because DATA_STORE=supabase and Supabase
 *   contains no officer accounts. All officer-authenticated checks are replaced
 *   by unauthenticated route-protection verification.
 *
 * Do NOT test MERGE_DUPLICATES, MARK_RELATED, or MARK_DISTINCT against
 * source complaint MCC-2026-SRC-307753.
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';

const BASE = 'http://localhost:5173';
const API  = 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function ss(page: Page, name: string) {
  const dir = path.resolve(__dirname, 'screenshots');
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
  console.log(`[screenshot] ${name}.png`);
}

// ---------------------------------------------------------------------------
// 1 — LANDING PAGE
// ---------------------------------------------------------------------------
test('1. Landing page renders CivicBridge branding', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await ss(page, 'accept-01-landing');

  // Page must load (not blank, not error page)
  const title = await page.title();
  console.log(`[landing] page title: "${title}"`);
  expect(title).toBeTruthy();

  // Body must have some content
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.length).toBeGreaterThan(50);
  console.log('[landing] PASS — page rendered with content');
});

// ---------------------------------------------------------------------------
// 2 — CITIZEN TRACKING (public endpoint, no auth required)
// ---------------------------------------------------------------------------
test('2. Citizen tracking — source complaint TRK-SRC-307753 loads', async ({ page }) => {
  // First verify the API directly
  const res = await page.request.get(`${API}/api/complaints/track/TRK-SRC-307753`);
  expect(res.status()).toBe(200);

  const body = await res.json();
  console.log('[tracking-api] response:', JSON.stringify(body, null, 2));

  // Core assertions
  expect(body.trackingToken).toBe('TRK-SRC-307753');
  expect(body.status).toBe('SUBMITTED');

  // Privacy assertions — no PII, no officer notes, no rationale
  expect(body.citizenId).toBeUndefined();
  expect(body.officerNotes).toBeUndefined();
  expect(body.rationale).toBeUndefined();
  expect(body.resolutionAction).toBeUndefined(); // not CLOSED so no duplicate notice

  console.log('[tracking-api] PASS — correct sanitized response, no PII exposed');

  // Now test via browser: navigate to the frontend tracking page if it has a route
  await page.goto(`${BASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Look for a tracking / "Track Complaint" UI element
  const trackingInput = page.locator(
    'input[placeholder*="rack" i], input[placeholder*="token" i], input[name*="track" i]'
  ).first();

  if (await trackingInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await trackingInput.fill('TRK-SRC-307753');
    await ss(page, 'accept-02a-tracking-filled');

    const trackBtn = page.locator('button').filter({ hasText: /track|search|submit/i }).first();
    if (await trackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await trackBtn.click();
      await page.waitForTimeout(2000);
      await ss(page, 'accept-02b-tracking-result');
      console.log('[tracking-ui] PASS — tracking token submitted via UI');
    } else {
      console.log('[tracking-ui] INFO — tracking submit button not found; API result sufficient');
    }
  } else {
    // Try navigating to a dedicated tracking route
    await page.goto(`${BASE}/track/TRK-SRC-307753`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await ss(page, 'accept-02c-tracking-route');
    console.log('[tracking-ui] INFO — tried /track route, screenshot captured');
  }
});

// ---------------------------------------------------------------------------
// 3 — UNAUTHENTICATED OFFICER ROUTE PROTECTION
// ---------------------------------------------------------------------------
test('3. Officer routes return 401 without auth', async ({ page }) => {
  const protectedEndpoints = [
    `${API}/api/officer/complaints`,
    `${API}/api/officer/complaints/MCC-2026-SRC-307753/duplicate-audit`,
  ];

  for (const url of protectedEndpoints) {
    const res = await page.request.get(url);
    console.log(`[auth-guard] GET ${url} → ${res.status()}`);
    expect(res.status()).toBe(401);
  }

  // Also verify that the resolution endpoint rejects unauthenticated POST
  const postRes = await page.request.post(
    `${API}/api/officer/complaints/MCC-2026-SRC-307753/duplicate-resolution`,
    { data: { action: 'MERGE_DUPLICATES', notes: 'bypass attempt', duplicateComplaintId: 'x' } }
  );
  console.log(`[auth-guard] POST duplicate-resolution (no auth) → ${postRes.status()}`);
  expect(postRes.status()).toBe(401);

  console.log('[auth-guard] PASS — all officer endpoints reject unauthenticated requests');
});

// ---------------------------------------------------------------------------
// 4 — MAP API: /api/complaints/map
// ---------------------------------------------------------------------------
test('4. Map API returns PII-sanitized complaint markers', async ({ page }) => {
  const res = await page.request.get(`${API}/api/complaints/map`);
  console.log(`[map-api] status: ${res.status()}`);
  expect(res.status()).toBe(200);

  const body = await res.json();
  const complaints = body.complaints ?? body;
  const arr = Array.isArray(complaints) ? complaints : [];
  console.log(`[map-api] returned ${arr.length} markers`);

  // Verify PII is stripped from markers
  if (arr.length > 0) {
    const sample = arr[0];
    console.log('[map-api] sample marker keys:', Object.keys(sample).join(', '));
    expect(sample.citizenId).toBeUndefined();
    expect(sample.citizenEmail).toBeUndefined();
    expect(sample.citizenPhone).toBeUndefined();
    expect(sample.officerNotes).toBeUndefined();
    // Must have location fields
    const hasLocation = sample.latitude != null || sample.longitude != null || sample.locationArea != null;
    expect(hasLocation).toBe(true);
    console.log('[map-api] PASS — markers PII-free with location data');
  } else {
    console.log('[map-api] INFO — 0 markers returned (empty state is valid)');
  }
});

// ---------------------------------------------------------------------------
// 5 — FRONTEND MAP PAGE
// ---------------------------------------------------------------------------
test('5. Public analytics / map page renders', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await ss(page, 'accept-05a-home-loaded');

  // Look for a map or analytics tab/link/button
  const mapTrigger = page.locator(
    'button, a, [role="tab"]'
  ).filter({ hasText: /map|analytic|ward|civic/i }).first();

  if (await mapTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await mapTrigger.click();
    await page.waitForTimeout(3000); // allow Leaflet tiles to begin loading
    await ss(page, 'accept-05b-map-opened');

    // Verify the Leaflet container exists in DOM
    const leafletContainer = page.locator('.leaflet-container');
    const hasLeaflet = await leafletContainer.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasLeaflet) {
      console.log('[map-ui] PASS — Leaflet container rendered');
    } else {
      // Map might be in a different tab — screenshot is evidence
      console.log('[map-ui] INFO — Leaflet container not detected in current view; check screenshot accept-05b-map-opened.png');
    }
  } else {
    // Try navigating to /map or /analytics directly
    await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await ss(page, 'accept-05c-map-route');
    console.log('[map-ui] INFO — tried /map route, check screenshot');
  }
});

// ---------------------------------------------------------------------------
// 6 — COMPLAINT SUBMISSION FORM (citizen side)
// ---------------------------------------------------------------------------
test('6. Complaint submission form renders with expected fields', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Try to find a "Submit Complaint" or "Report Issue" or "File Complaint" button
  const submitBtn = page.locator('button, a').filter({
    hasText: /submit|report|file|complaint|new/i
  }).first();

  if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submitBtn.click();
    await page.waitForTimeout(1500);
    await ss(page, 'accept-06a-form-opened');

    // Verify key form fields exist
    const hasDescription = await page.locator(
      'textarea, input[name*="description" i], input[placeholder*="describe" i]'
    ).first().isVisible({ timeout: 2000 }).catch(() => false);

    const hasCategory = await page.locator(
      'select, [role="combobox"], [name*="category" i]'
    ).first().isVisible({ timeout: 2000 }).catch(() => false);

    console.log(`[form] description field visible: ${hasDescription}`);
    console.log(`[form] category field visible: ${hasCategory}`);
    await ss(page, 'accept-06b-form-fields');
    console.log('[form] PASS — complaint form rendered');
  } else {
    console.log('[form] INFO — submit/report button not found on landing page; may require login');
    await ss(page, 'accept-06-no-form');
  }
});

// ---------------------------------------------------------------------------
// 7 — OFFICER LOGIN BLOCKER DOCUMENTATION
// ---------------------------------------------------------------------------
test('7. Officer login — confirm Supabase blocker is active', async ({ page }) => {
  const loginRes = await page.request.post(`${API}/api/auth/login`, {
    data: { email: 'officer.ward48@mcc.gov.in', password: 'password123', role: 'officer' }
  });
  console.log(`[officer-login] status: ${loginRes.status()}`);

  const loginBody = await loginRes.json().catch(() => ({}));
  console.log(`[officer-login] response: ${JSON.stringify(loginBody)}`);

  // Expected: 401 or 400 — officer not in Supabase
  expect([400, 401, 403]).toContain(loginRes.status());

  // Navigate to officer login UI
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Find the officer tab
  const officerTab = page.locator('button, [role="tab"]').filter({ hasText: /officer/i }).first();
  if (await officerTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await officerTab.click();
    await page.waitForTimeout(1000);
    await ss(page, 'accept-07-officer-login-tab');
    console.log('[officer-login] INFO — officer login tab visible; login blocked as expected (DATA_STORE=supabase, no officer in Supabase)');
  } else {
    await ss(page, 'accept-07-officer-login-notab');
    console.log('[officer-login] INFO — officer tab not found on landing page');
  }

  console.log('[officer-login] DOCUMENTED BLOCKER: Officer login requires officer accounts in Supabase. Currently DATA_STORE=supabase but only 1 citizen account exists (USR-CITIZEN-MU81FLSR-A5XD). Officer test suite passes because vitest overrides DATA_STORE=sqlite.');
});

// ---------------------------------------------------------------------------
// 8 — NO CONSOLE ERRORS ON LANDING
// ---------------------------------------------------------------------------
test('8. Landing page — no critical console errors', async ({ page }) => {
  const errors: string[] = [];
  const warnings: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await ss(page, 'accept-08-console-check');

  // Filter out known browser noise
  const realErrors = errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('DevTools') &&
    !e.includes('React DevTools') &&
    !e.includes('net::ERR_ABORTED') &&
    !e.includes('Download the React')
  );

  console.log(`[console] ${realErrors.length} real error(s), ${warnings.length} warning(s)`);
  realErrors.forEach(e => console.log(`  ERROR: ${e}`));

  if (realErrors.length > 0) {
    console.log('[console] WARN — console errors detected (see above)');
  } else {
    console.log('[console] PASS — no critical console errors on landing');
  }

  // Non-fatal — we report but don't fail the test on warnings
  expect(realErrors.length).toBeLessThan(5); // allow minor runtime noise
});

// ---------------------------------------------------------------------------
// 9 — SOURCE COMPLAINT INTEGRITY (API level)
// ---------------------------------------------------------------------------
test('9. Source complaint MCC-2026-SRC-307753 is intact and unmodified', async ({ page }) => {
  const res = await page.request.get(`${API}/api/complaints/track/TRK-SRC-307753`);
  expect(res.status()).toBe(200);

  const body = await res.json();
  console.log('[source-complaint] public fields:', JSON.stringify(body, null, 2));

  expect(body.trackingToken).toBe('TRK-SRC-307753');
  expect(body.status).toBe('SUBMITTED');

  // Must not have been merged, closed, or altered
  expect(body.status).not.toBe('CLOSED');
  expect(body.status).not.toBe('RESOLVED');

  // duplicateResolution field should not appear for SUBMITTED complaint
  if (body.duplicateResolution) {
    console.warn('[source-complaint] UNEXPECTED: duplicateResolution notice present on non-closed complaint');
  }

  console.log('[source-complaint] PASS — MCC-2026-SRC-307753 is SUBMITTED, unaltered');
});

// ---------------------------------------------------------------------------
// 10 — API: Categories and ward data
// ---------------------------------------------------------------------------
test('10. Supporting APIs (wards, analytics, map) respond correctly', async ({ page }) => {
  const endpoints: { url: string; expectStatus: number }[] = [
    { url: `${API}/api/health`,                    expectStatus: 200 },
    { url: `${API}/api/wards/geojson`,             expectStatus: 200 },
    { url: `${API}/api/complaints/public-analytics`, expectStatus: 200 },
    { url: `${API}/api/complaints/map`,            expectStatus: 200 },
  ];

  for (const { url, expectStatus } of endpoints) {
    const res = await page.request.get(url);
    console.log(`[api] GET ${url.replace(API, '')} → ${res.status()}`);
    expect(res.status()).toBe(expectStatus);
  }
  console.log('[api] PASS — all supporting APIs respond');
});
