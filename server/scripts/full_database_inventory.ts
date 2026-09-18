import { getSupabaseClient } from '../src/db/supabase.js';
import { initDatabase } from '../src/db/sqlite.js';
import fs from 'node:fs';
import path from 'node:path';

async function fullInventory() {
  console.log('================================================================');
  console.log('CIVICBRIDGE COMPLETE DATABASE & EVIDENCE INVENTORY');
  console.log('================================================================');

  // 1. SUPABASE POSTGRESQL & STORAGE
  const client = getSupabaseClient();
  if (client) {
    console.log('\n--- [SUPABASE] Table: public.users ---');
    const { data: users, error: uErr } = await client
      .from('users')
      .select('id, email, name, role, ward, department, created_at')
      .order('created_at', { ascending: true });

    if (uErr) {
      console.error('Error reading users:', uErr.message);
    } else {
      console.log(`Total records: ${users?.length || 0}`);
      users?.forEach((u, i) => {
        console.log(`  [${i + 1}] ID: ${u.id} | Email: ${u.email} | Name: ${u.name} | Role: ${u.role} | Ward: ${u.ward || 'N/A'} | Dept: ${u.department || 'N/A'}`);
      });
    }

    console.log('\n--- [SUPABASE] Table: public.complaints ---');
    const { data: complaints, error: cErr } = await client
      .from('complaints')
      .select('id, tracking_token, citizen_id, category, location_area, status, has_image, is_demo, created_at')
      .order('created_at', { ascending: true });

    if (cErr) {
      console.error('Error reading complaints:', cErr.message);
    } else {
      console.log(`Total records: ${complaints?.length || 0}`);
      complaints?.forEach((c, i) => {
        console.log(`  [${i + 1}] ID: ${c.id} | Token: ${c.tracking_token} | Category: ${c.category} | Status: ${c.status} | Area: ${c.location_area} | hasImage: ${c.has_image} | isDemo: ${c.is_demo} | Citizen: ${c.citizen_id}`);
      });
    }

    console.log('\n--- [SUPABASE] Table: public.complaint_resolution_audit ---');
    const { data: audits, error: aErr } = await client
      .from('complaint_resolution_audit')
      .select('id, cluster_id, primary_complaint_id, action_type, officer_id, officer_name, created_at')
      .order('created_at', { ascending: true });

    if (aErr) {
      console.error('Error reading audit table:', aErr.message);
    } else {
      console.log(`Total records: ${audits?.length || 0}`);
      audits?.forEach((a, i) => {
        console.log(`  [${i + 1}] ID: ${a.id} | Cluster: ${a.cluster_id} | Primary: ${a.primary_complaint_id} | Action: ${a.action_type} | Officer: ${a.officer_name}`);
      });
    }

    console.log('\n--- [SUPABASE] Storage: complaint-evidence ---');
    try {
      const { data: files, error: fErr } = await client.storage.from('complaint-evidence').list();
      if (fErr) {
        console.error('Error listing storage bucket:', fErr.message);
      } else {
        console.log(`Total objects: ${files?.length || 0}`);
        files?.forEach((f, i) => {
          console.log(`  [${i + 1}] Name: ${f.name} | Size: ${f.metadata?.size || 'unknown'} bytes | Created: ${f.created_at}`);
        });
      }
    } catch (sErr: any) {
      console.error('Storage access error:', sErr.message);
    }
  } else {
    console.log('[SUPABASE] Not configured or client failed to initialize.');
  }

  // 2. SQLITE LOCAL DATABASE
  console.log('\n================================================================');
  console.log('--- [SQLITE] civictrust.db ---');
  try {
    const sqlite = initDatabase();
    const sqUsers = sqlite.prepare('SELECT id, email, name, role, ward, department FROM users').all() as any[];
    console.log(`Table users (${sqUsers.length} records):`);
    sqUsers.forEach((u, i) => {
      console.log(`  [${i + 1}] ID: ${u.id} | Email: ${u.email} | Name: ${u.name} | Role: ${u.role}`);
    });

    const sqComplaints = sqlite.prepare('SELECT id, tracking_token, category, location_area, status, is_demo FROM complaints').all() as any[];
    console.log(`Table complaints (${sqComplaints.length} records):`);
    sqComplaints.forEach((c, i) => {
      console.log(`  [${i + 1}] ID: ${c.id} | Token: ${c.tracking_token} | Category: ${c.category} | Status: ${c.status} | isDemo: ${c.is_demo}`);
    });

    const sqAudit = sqlite.prepare('SELECT id, cluster_id, primary_complaint_id, action_type FROM complaint_resolution_audit').all() as any[];
    console.log(`Table complaint_resolution_audit (${sqAudit.length} records):`);
    sqAudit.forEach((a, i) => {
      console.log(`  [${i + 1}] ID: ${a.id} | Cluster: ${a.cluster_id} | Primary: ${a.primary_complaint_id} | Action: ${a.action_type}`);
    });
  } catch (err: any) {
    console.log('SQLite read notice:', err.message);
  }

  // 3. LOCAL FILE UPLOADS
  console.log('\n================================================================');
  console.log('--- [LOCAL FILES] Upload Directory ---');
  const uploadDir = path.resolve(process.cwd(), 'uploads');
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    console.log(`Path: ${uploadDir} (${files.length} files)`);
    files.forEach((f, i) => {
      console.log(`  [${i + 1}] ${f}`);
    });
  } else {
    console.log(`Directory does not exist: ${uploadDir}`);
  }

  console.log('================================================================');
}

fullInventory().catch(console.error);
