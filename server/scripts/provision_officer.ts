import { provisionOfficerAccount } from '../src/services/officerProvisioningService.js';
import { CONFIG } from '../src/config.js';

function parseArg(flag: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg ? arg.split('=')[1] : undefined;
}

export async function runOfficerProvisioningCli() {
  console.log('================================================================');
  console.log('CIVICTRUST AI — SECURE MUNICIPAL OFFICER PROVISIONING CLI');
  console.log('================================================================');
  console.log(`Target Data Store: ${CONFIG.DATA_STORE}`);
  if (CONFIG.DATA_STORE === 'supabase') {
    console.log(`Supabase URL:      ${CONFIG.SUPABASE_URL || '(not set)'}`);
  } else {
    console.log(`SQLite Path:       ${CONFIG.DB_PATH}`);
  }
  const isDryRun = process.argv.includes('--dry-run');

  if (isDryRun) {
    console.log('>>> [DRY-RUN MODE ACTIVATED] Validating inputs, database connection, and account uniqueness without modifying database.');
  }
  console.log('----------------------------------------------------------------');

  const email =
    parseArg('email') ||
    process.env.OFFICER_EMAIL ||
    'officer.ward48@mcc.gov.in';

  const name =
    parseArg('name') ||
    process.env.OFFICER_NAME ||
    'Ward 48 Junior Engineer';

  const ward =
    parseArg('ward') ||
    process.env.OFFICER_WARD ||
    'Ward 48 - Kuvempunagar';

  const department =
    parseArg('department') ||
    process.env.OFFICER_DEPARTMENT ||
    'MCC Engineering Division';

  const password =
    parseArg('password') ||
    process.env.OFFICER_INITIAL_PASSWORD ||
    undefined;

  try {
    const result = await provisionOfficerAccount({
      email,
      name,
      ward,
      department,
      password,
      dryRun: isDryRun,
    });

    if (result.isDryRun) {
      console.log(`\n[DRY-RUN RESULT] Officer account validation successful:`);
      console.log(`  ID:                  ${result.user.id}`);
      console.log(`  Email:               ${result.user.email}`);
      console.log(`  Name:                ${result.user.name}`);
      console.log(`  Role:                ${result.user.role}`);
      console.log(`  Ward:                ${result.user.ward}`);
      console.log(`  Department:          ${result.user.department}`);
      console.log(`  Target Store:        ${CONFIG.DATA_STORE}`);
      console.log(`  Account Status:      Ready to provision (No collision with existing accounts)`);
      console.log(`  Password Security:   Bcrypt hashing verified`);
      console.log(`  Database Integrity:  100% UNTOUCHED (0 records written, modified, or deleted)\n`);
    } else if (result.status === 'ALREADY_EXISTS') {
      console.log(`\n[IDEMPOTENT CHECK] Officer account already exists:`);
      console.log(`  ID:         ${result.user.id}`);
      console.log(`  Email:      ${result.user.email}`);
      console.log(`  Name:       ${result.user.name}`);
      console.log(`  Role:       ${result.user.role}`);
      console.log(`  Ward:       ${result.user.ward || '(none)'}`);
      console.log(`  Department: ${result.user.department || '(none)'}`);
      console.log(`  Status:     UNMODIFIED (password hash preserved)\n`);
    } else {
      console.log(`\n[SUCCESS] Officer account provisioned:`);
      console.log(`  ID:         ${result.user.id}`);
      console.log(`  Email:      ${result.user.email}`);
      console.log(`  Name:       ${result.user.name}`);
      console.log(`  Role:       ${result.user.role}`);
      console.log(`  Ward:       ${result.user.ward}`);
      console.log(`  Department: ${result.user.department}`);

      if (result.generatedPassword) {
        console.log('\n----------------------------------------------------------------');
        console.log('TEMPORARY INITIAL PASSWORD GENERATED:');
        console.log(`  ${result.generatedPassword}`);
        console.log('IMPORTANT: Record this password immediately in a secure vault.');
        console.log('It is cryptographically hashed in the database and will NOT be shown again.');
        console.log('----------------------------------------------------------------\n');
      } else {
        console.log('\n  Password:   [Pre-configured from environment, stored as bcrypt hash]\n');
      }
    }
  } catch (err: any) {
    console.error(`\n[ERROR] Officer provisioning failed: ${err.message}\n`);
    process.exit(1);
  }
}

// Execute when run directly
if (
  process.argv[1]?.endsWith('provision_officer.ts') ||
  process.argv[1]?.endsWith('provision_officer.js')
) {
  runOfficerProvisioningCli();
}
