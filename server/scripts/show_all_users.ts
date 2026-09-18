import { getSupabaseClient } from '../src/db/supabase.js';

async function main() {
  const client = getSupabaseClient();
  if (!client) {
    console.log('No supabase client');
    return;
  }
  const { data: users, error } = await client
    .from('users')
    .select('id, email, name, role, ward, department')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`SUPABASE USERS (${users?.length || 0}):`);
  users?.forEach((u, i) => {
    console.log(`[${i+1}] ${u.id} | ${u.email} | ${u.name} | ${u.role} | Ward: ${u.ward || 'N/A'}`);
  });
}

main();
