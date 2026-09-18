import { getSupabaseClient } from '../src/db/supabase.js';
import bcrypt from 'bcryptjs';

async function restoreAndClean() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client failed');

  console.log('1. Clearing test complaints and audits created during test run...');
  await client.from('complaint_resolution_audit').delete().neq('id', 'DO_NOT_DELETE');
  await client.from('complaints').delete().neq('id', 'DO_NOT_DELETE');

  console.log('2. Deleting all test users created during test run...');
  await client.from('users').delete().neq('email', 'gallikattip@gmail.com');

  console.log('3. Ensuring gallikattip@gmail.com is present and active...');
  const { data: existingUser } = await client
    .from('users')
    .select('*')
    .eq('email', 'gallikattip@gmail.com')
    .maybeSingle();

  if (!existingUser) {
    console.log('Restoring account USR-CITIZEN-MU7GB0J8-7S0B...');
    const hash = bcrypt.hashSync('password123', 10);
    const { error: insertErr } = await client.from('users').insert({
      id: 'USR-CITIZEN-MU7GB0J8-7S0B',
      email: 'gallikattip@gmail.com',
      password_hash: hash,
      name: 'Prasann Gallikatti',
      role: 'CITIZEN',
      ward: 'kuvempu nagar, 43',
      is_active: true,
      created_at: '2026-09-18T21:19:00.000Z',
    });
    if (insertErr) {
      throw new Error(`Failed to restore user: ${insertErr.message}`);
    }
    console.log('-> User successfully restored with ID USR-CITIZEN-MU7GB0J8-7S0B.');
  } else {
    console.log('-> User already exists:', existingUser.id, existingUser.email);
  }

  // Final inventory
  const { data: users } = await client.from('users').select('id, email, name, role, ward');
  const { count: compCount } = await client.from('complaints').select('*', { count: 'exact', head: true });
  const { count: auditCount } = await client.from('complaint_resolution_audit').select('*', { count: 'exact', head: true });

  console.log('\nFINAL PRODUCTION STATE:');
  console.log('Users count:', users?.length);
  users?.forEach(u => console.log(`  ${u.id} | ${u.email} | ${u.name} | ${u.role} | Ward: ${u.ward}`));
  console.log('Complaints count:', compCount);
  console.log('Audit records count:', auditCount);
}

restoreAndClean().catch(console.error);
