import { getSupabaseClient } from '../src/db/supabase.js';
import { AUTHENTIC_USER_IDS, AUTHENTIC_COMPLAINT_IDS } from '../src/db/interfaces.js';

async function audit() {
  const client = getSupabaseClient();
  if (!client) {
    console.error('Supabase client failed');
    process.exit(1);
  }

  const { data: users, error: uErr } = await client
    .from('users')
    .select('id, email, name, role, ward, department, created_at')
    .order('created_at', { ascending: true });

  if (uErr) {
    console.error('Users error:', uErr);
    process.exit(1);
  }

  const { data: complaints, error: cErr } = await client
    .from('complaints')
    .select('id, tracking_token, citizen_id, category, location_area, is_demo, created_at')
    .order('created_at', { ascending: true });

  if (cErr) {
    console.error('Complaints error:', cErr);
    process.exit(1);
  }

  console.log('--- ALL USERS IN SUPABASE (' + users.length + ') ---');
  const authenticUsers = [];
  const nonBaselineUsers = [];
  for (const u of users) {
    if ((AUTHENTIC_USER_IDS as readonly string[]).includes(u.id)) {
      authenticUsers.push(u);
      console.log('AUTHENTIC:', u.id, u.email, `(${u.role})`, u.name, u.created_at);
    } else {
      nonBaselineUsers.push(u);
      console.log('NON-BASELINE / TEST:', u.id, u.email, `(${u.role})`, u.name, u.created_at);
    }
  }

  console.log('\n--- ALL COMPLAINTS IN SUPABASE (' + complaints.length + ') ---');
  const authenticComplaints = [];
  const nonBaselineComplaints = [];
  for (const c of complaints) {
    if ((AUTHENTIC_COMPLAINT_IDS as readonly string[]).includes(c.id)) {
      authenticComplaints.push(c);
      console.log('AUTHENTIC:', c.id, c.tracking_token, c.category, c.location_area, 'is_demo=' + c.is_demo, c.created_at);
    } else {
      nonBaselineComplaints.push(c);
      console.log('NON-BASELINE / TEST:', c.id, c.tracking_token, c.category, c.location_area, 'is_demo=' + c.is_demo, c.created_at);
    }
  }

  console.log('\nSUMMARY:');
  console.log('Authentic Users Count:', authenticUsers.length, 'of 13');
  console.log('Non-Baseline Users Count:', nonBaselineUsers.length);
  console.log('Authentic Complaints Count:', authenticComplaints.length, 'of 11');
  console.log('Non-Baseline Complaints Count:', nonBaselineComplaints.length);
}

audit().catch(console.error);
