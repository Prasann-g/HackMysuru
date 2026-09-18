import { complaintStore } from '../src/db/complaintStore.js';

async function testAnalytics() {
  const analytics = await complaintStore.getPublicAnalytics();
  console.log('PUBLIC ANALYTICS RESPONSE:');
  console.log(JSON.stringify(analytics, null, 2));

  const list = await complaintStore.listAll();
  console.log('\nLIST ALL COMPLAINTS COUNT:', list.length);
}

testAnalytics().catch(console.error);
