import { getSupabaseClient } from '../src/db/supabase.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function listWithRetry(client: any, bucket: string, prefix: string, options: any, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await client.storage.from(bucket).list(prefix, options);
      if (error) {
        if (attempt === maxRetries) throw error;
        console.warn(`Retry ${attempt}/${maxRetries} listing '${prefix}': ${error.message}`);
        await sleep(500 * attempt);
        continue;
      }
      return data;
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      console.warn(`Retry ${attempt}/${maxRetries} listing '${prefix}': ${err.message}`);
      await sleep(500 * attempt);
    }
  }
}

async function listAllFilesRecursively(client: any, bucket: string, prefix: string = ''): Promise<string[]> {
  let filePaths: string[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    await sleep(20);
    const items = await listWithRetry(client, bucket, prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (!items || items.length === 0) {
      break;
    }

    for (const item of items) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        // Folder -> recurse
        const subFiles = await listAllFilesRecursively(client, bucket, fullPath);
        filePaths.push(...subFiles);
      } else {
        // File
        filePaths.push(fullPath);
      }
    }

    if (items.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return filePaths;
}

async function purgeAllStorage() {
  const client = getSupabaseClient();
  if (!client) throw new Error('No client');

  console.log('Discovering all files in complaint-evidence recursively...');
  const allFiles = await listAllFilesRecursively(client, 'complaint-evidence');
  console.log(`Found ${allFiles.length} files to delete.`);

  if (allFiles.length > 0) {
    // Delete in batches of 50
    const batchSize = 50;
    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize);
      console.log(`Deleting batch ${Math.floor(i / batchSize) + 1} (${batch.length} files)...`);
      let deleted = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const { error } = await client.storage.from('complaint-evidence').remove(batch);
          if (error) {
            console.warn(`Retry ${attempt}/5 removing batch: ${error.message}`);
            await sleep(500 * attempt);
            continue;
          }
          deleted = true;
          break;
        } catch (err: any) {
          console.warn(`Retry ${attempt}/5 removing batch: ${err.message}`);
          await sleep(500 * attempt);
        }
      }
      if (!deleted) {
        throw new Error(`Failed to delete batch after retries.`);
      }
      await sleep(100);
    }
  }

  // Verify
  console.log('\nRunning post-purge verification...');
  const remaining = await listAllFilesRecursively(client, 'complaint-evidence');
  console.log(`Verification: Exactly ${remaining.length} files remain in complaint-evidence.`);

  const { data: root } = await client.storage.from('complaint-evidence').list();
  console.log('Root listing after purge:', root);
}

purgeAllStorage().catch(console.error);
