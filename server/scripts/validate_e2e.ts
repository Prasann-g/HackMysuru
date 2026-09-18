import { app } from '../src/index.js';
import { complaintStore } from '../src/db/complaintStore.js';
import sharp from 'sharp';

async function runE2eValidation() {
  console.log('=== PHASE 4: SUPABASE END-TO-END FLOW VALIDATION ===');
  const server = app.listen(0);
  await new Promise((r) => server.on('listening', r));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;
  console.log('Test Server listening on dynamic port:', port);

  const results: Record<string, any> = {};

  try {
    // 1. Citizen Login & Authentication
    console.log('[1/8] Validating Citizen Login & Authentication...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'suresh.gowda@example.com', password: 'password123' }),
    });
    if (!loginRes.ok) throw new Error(`Citizen login failed with status ${loginRes.status}`);
    const loginData: any = await loginRes.json();
    const citizenToken = loginData.token;

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    const meData: any = await meRes.json();
    if (meData.user.email !== 'suresh.gowda@example.com' || meData.user.role !== 'CITIZEN') {
      throw new Error(`Profile verification failed: ${JSON.stringify(meData)}`);
    }
    results['citizenAuth'] = { passed: true, email: meData.user.email, role: meData.user.role };
    console.log('  -> PASSED: Citizen login and /me token verification successful.');

    // 2. Citizen Complaint Submission & 3. Complaint Image Upload/Retrieval
    console.log('[2/8 & 3/8] Validating Citizen Complaint Submission with Image Evidence...');
    const nonce = Date.now();
    const testImgBuffer = await sharp({
      create: { width: 60, height: 60, channels: 3, background: { r: 80, g: 160, b: 220 } },
    })
      .composite([
        {
          input: Buffer.from(`
            <svg width="60" height="60"><circle cx="30" cy="30" r="15" fill="orange"/></svg>
          `),
          top: 0,
          left: 0,
        },
      ])
      .jpeg()
      .toBuffer();

    const form = new FormData();
    form.append('category', 'garbage_dumping');
    form.append('description', `Authentic end-to-end flow test garbage pile obstruction ${nonce}`);
    form.append('observedDate', '2026-09-18');
    form.append('locationArea', 'Karaswadi');
    form.append('image', new Blob([testImgBuffer], { type: 'image/jpeg' }), 'e2e_evidence.jpg');

    const submitRes = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: form,
    });
    if (submitRes.status !== 201) throw new Error(`Complaint submission failed with ${submitRes.status}`);
    const submitData: any = await submitRes.json();
    const complaintId = submitData.complaint.id;
    const trackingToken = submitData.complaint.trackingToken;
    results['complaintSubmission'] = { passed: true, complaintId, trackingToken };
    console.log(`  -> PASSED: Complaint submitted. ID: ${complaintId} Tracking Token: ${trackingToken}`);

    // Image Retrieval from Supabase Storage
    console.log('[3/8] Validating Complaint Image Retrieval from Storage...');
    const imgRes = await fetch(`${baseUrl}/api/complaints/${complaintId}/image`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    if (!imgRes.ok) throw new Error(`Image retrieval failed with status ${imgRes.status}`);
    const retrievedBytes = await imgRes.arrayBuffer();
    if (retrievedBytes.byteLength !== testImgBuffer.byteLength) {
      throw new Error(
        `Retrieved image size mismatch: expected ${testImgBuffer.byteLength}, got ${retrievedBytes.byteLength}`
      );
    }
    results['imageUploadAndRetrieval'] = { passed: true, byteLength: retrievedBytes.byteLength };
    console.log(`  -> PASSED: Image retrieved from Supabase Storage with exact size (${retrievedBytes.byteLength} bytes).`);

    // 4. Duplicate Complaint Detection
    console.log('[4/8] Validating Duplicate Complaint Detection...');
    const dupForm = new FormData();
    dupForm.append('category', 'garbage_dumping');
    dupForm.append('description', `Completely different description text about trash ${nonce}`);
    dupForm.append('observedDate', '2026-09-18');
    dupForm.append('locationArea', 'Karaswadi');
    dupForm.append('image', new Blob([testImgBuffer], { type: 'image/jpeg' }), 'duplicate.jpg');

    const dupRes = await fetch(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: dupForm,
    });
    if (dupRes.status !== 409) throw new Error(`Expected 409 Conflict, got ${dupRes.status}`);
    const dupData: any = await dupRes.json();
    if (dupData.code !== 'EXACT_IMAGE_DUPLICATE') {
      throw new Error(`Expected EXACT_IMAGE_DUPLICATE code, got ${dupData.code}`);
    }
    results['duplicateDetection'] = {
      passed: true,
      code: dupData.code,
      matchedId: dupData.existingComplaint.id,
    };
    console.log(`  -> PASSED: Duplicate successfully rejected with HTTP 409 Conflict (${dupData.code}).`);

    // 5. Officer Complaint Queue
    console.log('[5/8] Validating Officer Complaint Queue...');
    const offLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'officer.ward48@mcc.gov.in', password: 'Officer@Mysuru48' }),
    });
    const offData: any = await offLoginRes.json();
    const officerToken = offData.token;

    const queueRes = await fetch(`${baseUrl}/api/officer/complaints`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    if (!queueRes.ok) throw new Error(`Officer queue failed with ${queueRes.status}`);
    const queueData: any = await queueRes.json();
    const foundInQueue = queueData.complaints.some((c: any) => c.id === complaintId);
    if (!foundInQueue) throw new Error('Submitted complaint not found in officer queue');
    results['officerQueue'] = { passed: true, totalQueueItems: queueData.count, foundSubmitted: true };
    console.log(`  -> PASSED: Officer queue retrieved (${queueData.count} items), found new complaint.`);

    // 6. Complaint Status Updates
    console.log('[6/8] Validating Complaint Status Update...');
    const updateRes = await fetch(`${baseUrl}/api/officer/complaints/${complaintId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerToken}`,
      },
      body: JSON.stringify({
        status: 'UNDER_REVIEW',
        assignedDepartment: 'MCC Health & Sanitation Department',
        reviewNotes: 'Verified during Phase 4 End-to-End validation suite.',
      }),
    });
    if (!updateRes.ok) throw new Error(`Status update failed with ${updateRes.status}`);
    const updateData: any = await updateRes.json();
    if (updateData.complaint.status !== 'UNDER_REVIEW') throw new Error('Updated status mismatch');
    results['statusUpdate'] = { passed: true, updatedStatus: updateData.complaint.status };
    console.log('  -> PASSED: Complaint updated to UNDER_REVIEW by Officer.');

    // 7. Public Map & Analytics
    console.log('[7/8] Validating Public Map & Analytics...');
    const analyticsRes = await fetch(`${baseUrl}/api/complaints/public-analytics`);
    if (!analyticsRes.ok) throw new Error(`Public analytics failed with ${analyticsRes.status}`);
    const analyticsData: any = await analyticsRes.json();
    if (
      typeof analyticsData.totalComplaints !== 'number' ||
      typeof analyticsData.resolutionRatePercent !== 'number'
    ) {
      throw new Error('Analytics payload format invalid');
    }
    // Verify zero PII
    for (const c of analyticsData.recentComplaints) {
      if (c.citizenId || c.email || c.name || c.phone) {
        throw new Error('PII detected in public analytics!');
      }
    }
    results['publicAnalytics'] = {
      passed: true,
      totalComplaints: analyticsData.totalComplaints,
      resolutionRate: analyticsData.resolutionRatePercent,
      zeroPiiConfirmed: true,
    };
    console.log(
      `  -> PASSED: Public analytics computed (Total: ${analyticsData.totalComplaints}, Zero PII verified).`
    );

    // 8. Complaint Tracking
    console.log('[8/8] Validating Public Complaint Tracking...');
    const trackRes = await fetch(`${baseUrl}/api/complaints/track/${trackingToken}`);
    if (!trackRes.ok) throw new Error(`Tracking failed with status ${trackRes.status}`);
    const trackData: any = await trackRes.json();
    if (trackData.trackingToken !== trackingToken || trackData.status !== 'UNDER_REVIEW') {
      throw new Error('Tracking data mismatch');
    }
    if (trackData.citizenId || trackData.email) {
      throw new Error('PII found in public tracking response!');
    }
    results['complaintTracking'] = { passed: true, status: trackData.status, sanitized: true };
    console.log(
      `  -> PASSED: Public tracking verified for ${trackingToken} with sanitized status UNDER_REVIEW.`
    );

    // Clean up temporary test complaint
    await complaintStore.clearNonDemo();
    console.log('Temporary test complaint cleaned up safely.');

    console.log('\n=== ALL 8 END-TO-END VALIDATION FLOWS PASSED WITH ZERO ERRORS ===');
    console.log(JSON.stringify(results, null, 2));
  } finally {
    // Force-close all keep-alive connections so the HTTP server exits immediately.
    // server.closeAllConnections() is available from Node 18.2+.
    if (typeof (server as any).closeAllConnections === 'function') {
      (server as any).closeAllConnections();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runE2eValidation()
  .then(() => {
    console.log('\nE2E script completed. Exiting with code 0.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('E2E Validation Failed:', err);
    process.exit(1);
  });
