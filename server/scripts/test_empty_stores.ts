import { complaintStore } from '../src/db/complaintStore.js';

async function testStores() {
  const citizenComplaints = await complaintStore.findByCitizenId('USR-CITIZEN-MU7GB0J8-7S0B');
  console.log('Citizen complaints count for gallikattip@gmail.com:', citizenComplaints.length);

  const officerQueue = await complaintStore.listForOfficer({});
  console.log('Officer queue count:', officerQueue.length);

  const candidates = await complaintStore.listCandidatesForVerification();
  console.log('Candidates for verification count:', candidates.length);

  const nonExistent = await complaintStore.findByTrackingToken('TRK-NONEXISTENT-999');
  console.log('Lookup nonexistent token:', nonExistent ? 'FOUND' : 'NULL (Graceful)');
}

testStores().catch(console.error);
