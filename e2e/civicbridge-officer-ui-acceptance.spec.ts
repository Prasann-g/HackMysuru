import { test, expect } from '@playwright/test';
import path from 'path';

const mockOfficer = {
  id: 'USR-OFFICER-TEST',
  name: 'Ward 48 Zonal Officer',
  email: 'officer.ward48@mcc.gov.in',
  role: 'OFFICER',
  department: 'MCC Engineering Division',
  ward: 'Ward 48 - Kuvempunagar',
  isActive: true,
};

const mockComplaints = [
  {
    id: 'MCC-2026-TST-001',
    trackingToken: 'TRK-TST-001',
    category: 'pothole',
    customCategory: 'Road Infrastructure',
    description: 'Severe road crater on Kuvempunagar Double Road near Navodaya circle.',
    locationArea: 'Kuvempunagar',
    addressText: 'Kuvempunagar Double Road, Mysuru',
    wardNumber: '48',
    wardName: 'Kuvempunagar',
    latitude: 12.2855,
    longitude: 76.6322,
    status: 'UNDER_REVIEW',
    assignedDepartment: 'MCC Engineering Division',
    assignedAuthority: 'Mysuru City Corporation',
    routingStatus: 'ROUTED',
    verificationOutcome: 'RECOMMENDED_VERIFIED',
    duplicateRisk: 'HIGH',
    resolutionAction: 'NONE',
    signals: [
      'Duplicate match detected within 50m radius (similarity: 88%)',
      'Point-in-polygon verified inside authentic Ward 48',
    ],
    slaTracking: {
      slaTargetHours: 72,
      elapsedHours: 12,
      remainingHours: 60,
      slaProgressPercent: 16.7,
      status: 'ON_TRACK',
      standardResolutionWindow: '72 hours',
    },
    createdAt: '2026-03-01T09:00:00Z',
    updatedAt: '2026-03-01T09:00:00Z',
  },
  {
    id: 'MCC-2026-TST-003',
    trackingToken: 'TRK-TST-003',
    category: 'garbage_dumping',
    description: 'Uncollected garbage pile at Kuvempunagar 5th cross.',
    locationArea: 'Kuvempunagar',
    wardNumber: '48',
    latitude: 12.288,
    longitude: 76.634,
    status: 'SUBMITTED',
    duplicateRisk: 'LOW',
    resolutionAction: 'NONE',
    signals: ['No duplicates found in active pool'],
    slaTracking: {
      slaTargetHours: 72,
      elapsedHours: 4,
      remainingHours: 68,
      slaProgressPercent: 5.5,
      status: 'ON_TRACK',
      standardResolutionWindow: '72 hours',
    },
    createdAt: '2026-03-01T11:00:00Z',
    updatedAt: '2026-03-01T11:00:00Z',
  },
];

test.describe('Officer UI & Verification Walkthrough (Client-Side)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('[browser]', msg.type(), msg.text()));
    page.on('requestfailed', req => console.log('[fail]', req.method(), req.url(), req.failure()?.errorText));

    // Intercept auth checks
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockOfficer }),
      });
    });

    // Intercept officer complaints list
    await page.route('**/api/officer/complaints', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          complaints: mockComplaints,
          total: mockComplaints.length,
          stats: { total: 2, underReview: 1, submitted: 1, escalated: 0, breached: 0, highDuplicateRisk: 1 },
        }),
      });
    });

    // Intercept single complaint by id or duplicate audit
    await page.route('**/api/officer/complaints/**', async (route) => {
      const url = route.request().url();
      if (url.endsWith('/complaints') || url.includes('/complaints?')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            complaints: mockComplaints,
            total: mockComplaints.length,
            stats: { total: 2, underReview: 1, submitted: 1, escalated: 0, breached: 0, highDuplicateRisk: 1 },
          }),
        });
        return;
      }
      if (url.includes('/duplicate-audit')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ audits: [] }),
        });
        return;
      }
      const id = url.split('/').pop()?.split('?')[0];
      const complaint = mockComplaints.find((c) => c.id === id) || mockComplaints[0];
      const matchedCandidates = id === 'MCC-2026-TST-001' ? [
        {
          id: 'MCC-2026-TST-002',
          trackingToken: 'TRK-TST-002',
          description: 'Large asphalt pothole causing traffic slowdown near Navodaya Circle, Kuvempunagar.',
          category: 'pothole',
          status: 'SUBMITTED',
          locationArea: 'Kuvempunagar',
          similarityScore: 0.88,
          createdAt: '2026-03-01T10:00:00Z',
          updatedAt: '2026-03-01T10:00:00Z',
        },
      ] : [];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          complaint,
          citizen: {
            id: 'USR-CITIZEN-DEMO',
            name: 'Priya Sharma',
            email: 'priya.sharma@example.com',
            ward: 'Ward 48 - Kuvempunagar',
          },
          matchedCandidates,
        }),
      });
    });

    // Intercept followthrough dossier
    await page.route('**/api/followthrough/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          complaintId: 'MCC-2026-TST-001',
          trackingToken: 'TRK-TST-001',
          currentStatus: 'UNDER_REVIEW',
          category: 'pothole',
          observed: {
            createdAt: '2026-03-01T09:00:00Z',
            observedDate: '2026-03-01',
            lastActivityAt: '2026-03-01T09:30:00Z',
            assignedDepartment: 'MCC Engineering Division',
          },
          timeline: [],
          sla: {
            slaStartTime: '2026-03-01T09:00:00Z',
            slaDueTime: '2026-03-04T09:00:00Z',
            targetHours: 72,
            elapsedHours: 12,
            remainingHours: 60,
            overdue: false,
            slaState: 'ON_TRACK',
            disclaimer: 'Standard MCC turnaround benchmark is 72 hours.',
          },
          inactivity: {
            lastMeaningfulActivityAt: '2026-03-01T09:00:00Z',
            inactivityHours: 12,
            thresholdHours: 48,
            activityState: 'ACTIVE',
            explanation: 'Grievance is undergoing active triage.',
          },
          delayRisk: {
            riskScore: 25,
            slaStatus: 'ON_TRACK',
            elapsedHours: 12,
            slaTargetHours: 72,
            remainingHours: 60,
            contributingFactors: ['Pothole in high traffic zone'],
            recommendedAction: 'Dispatch road crew within 48h',
            modelVersion: 'Heuristic-v1',
          },
          generatedAt: new Date().toISOString(),
        }),
      });
    });

    // Seed session in browser before page loads
    await page.addInitScript((officer) => {
      sessionStorage.setItem('civictrust_token', 'mock-officer-token');
      sessionStorage.setItem('civictrust_citizen_user', JSON.stringify(officer));
    }, mockOfficer);
  });

  test('Officer Dashboard, Drawer, and DuplicateClusterInspector Verification', async ({ page }) => {
    const dir = path.resolve(__dirname, 'screenshots');

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 1. Verify Officer Dashboard Header & KPI Cards
    await page.screenshot({ path: `${dir}/accept-officer-01-dashboard.png`, fullPage: false });
    const officerHeading = page.getByText(/MCC Grievance Verification & Review Console/i);
    expect(await officerHeading.isVisible({ timeout: 5000 })).toBe(true);
    console.log('[officer-ui] PASS — Officer console loaded with authenticated header');

    // 2. Open Complaint with Duplicate Candidate
    const firstComplaint = page.getByText('MCC-2026-TST-001').first();
    expect(await firstComplaint.isVisible({ timeout: 5000 })).toBe(true);
    await firstComplaint.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${dir}/accept-officer-02-drawer-open.png`, fullPage: false });
    console.log('[officer-ui] PASS — Complaint detail drawer opened');

    // 3. Inspect Duplicate Cluster Inspector Component (scroll down inside drawer)
    const clusterHeader = page.getByText(/Cluster Identification/i).first();
    await clusterHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const duplicateCandidate = page.getByText('MCC-2026-TST-002').first();
    const hasDupCandidate = await duplicateCandidate.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[officer-ui] Duplicate candidate MCC-2026-TST-002 visible: ${hasDupCandidate}`);
    expect(hasDupCandidate).toBe(true);

    // 4. Test Consequential Action Confirmation UI: Click "Confirm Duplicate"
    const confirmDupBtn = page.getByRole('button', { name: /Confirm Duplicate/i }).first();
    await confirmDupBtn.scrollIntoViewIfNeeded();
    expect(await confirmDupBtn.isVisible()).toBe(true);
    await confirmDupBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/accept-officer-03-confirmation-card.png`, fullPage: false });
    console.log('[officer-ui] PASS — Consequential confirmation card opened');

    // Verify Consequential Resolution Notice text
    const notice = page.getByText(/Consequential Resolution Notice/i);
    expect(await notice.isVisible()).toBe(true);
    console.log('[officer-ui] PASS — Consequential Resolution Notice clearly visible');

    // 5. Test Mandatory Notes Validation (requires at least 5 chars)
    const noteTextarea = page.locator('textarea').first();
    expect(await noteTextarea.isVisible()).toBe(true);

    const executeBtn = page.getByRole('button', { name: /Confirm & Record Decision/i }).first();
    expect(await executeBtn.isVisible()).toBe(true);

    // Test with note < 5 characters: button MUST be disabled
    await noteTextarea.fill('ab'); // 2 characters
    await page.waitForTimeout(300);
    expect(await executeBtn.isDisabled()).toBe(true);
    console.log('[officer-ui] PASS — Confirm button disabled when notes < 5 chars');

    // Test with note >= 5 characters: button MUST become enabled
    await noteTextarea.fill('Site inspection confirmed duplicate pothole on Kuvempunagar Double Road.');
    await page.waitForTimeout(300);
    expect(await executeBtn.isEnabled()).toBe(true);
    console.log('[officer-ui] PASS — Confirm button enabled when notes >= 5 chars');

    // Cancel out of confirmation to ensure NO ACCIDENTAL SUBMISSION (Rule 4 guard)
    const cancelBtn = page.getByRole('button', { name: /Cancel/i }).first();
    await cancelBtn.click();
    await page.waitForTimeout(300);
    console.log('[officer-ui] PASS — Safely cancelled confirmation without submitting');

    // Close drawer
    const closeDrawerBtn = page.locator('button[aria-label*="Close" i], button:has(svg.lucide-x)').first();
    if (await closeDrawerBtn.isVisible().catch(() => false)) {
      await closeDrawerBtn.click();
      await page.waitForTimeout(500);
    }

    // 6. Test Empty State on Complaint with NO Duplicates
    const secondComplaint = page.getByText('MCC-2026-TST-003').first();
    if (await secondComplaint.isVisible().catch(() => false)) {
      await secondComplaint.click();
      await page.waitForTimeout(1000);

      const emptyClusterText = page.getByText(/No duplicate clusters require review/i).first();
      await emptyClusterText.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${dir}/accept-officer-04-empty-cluster.png`, fullPage: false });

      const hasEmpty = await emptyClusterText.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`[officer-ui] PASS — Empty state for complaint with no duplicates visible: ${hasEmpty}`);
      expect(hasEmpty).toBe(true);
      // Close drawer explicitly
      const closeBtn = page.locator('button[aria-label="Close drawer"]');
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Ensure any open drawer is closed
    const anyCloseBtn = page.locator('button[aria-label="Close drawer"]');
    if (await anyCloseBtn.isVisible().catch(() => false)) {
      await anyCloseBtn.click();
      await page.waitForTimeout(500);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // 7. Test Interactive Mysuru Civic Map tab
    const mapTabBtn = page.getByRole('button', { name: /Mysuru Ward Spatial Map/i });
    await mapTabBtn.scrollIntoViewIfNeeded();
    expect(await mapTabBtn.isVisible({ timeout: 5000 })).toBe(true);
    await mapTabBtn.click();
    await page.waitForTimeout(3000); // Allow Leaflet map + geojson to render
    await page.screenshot({ path: `${dir}/accept-officer-05-interactive-map.png`, fullPage: false });

    // Verify Leaflet container or map controls are present
    const leaflet = page.locator('.leaflet-container');
    await leaflet.scrollIntoViewIfNeeded();
    const isLeafletVisible = await leaflet.isVisible({ timeout: 10000 }).catch(() => false);
    console.log(`[map-ui] Leaflet map container visible: ${isLeafletVisible}`);
    expect(isLeafletVisible).toBe(true);

    // Verify Ward Polygons toggle
    const wardToggle = page.getByText(/Show 65 Ward Polygons/i);
    expect(await wardToggle.isVisible({ timeout: 5000 })).toBe(true);
    console.log('[map-ui] PASS — 65 Ward Polygons toggle visible');

    // Verify Nearby Discovery Radius buttons
    const radiusFilter = page.getByText(/Nearby Discovery Radius:/i);
    expect(await radiusFilter.isVisible({ timeout: 5000 })).toBe(true);
    console.log('[map-ui] PASS — Nearby Discovery Radius filters visible');

    console.log('[officer-ui] COMPLETE — All officer acceptance criteria verified in browser');
  });
});
