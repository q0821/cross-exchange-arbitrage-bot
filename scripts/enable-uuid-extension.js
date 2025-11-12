#!/usr/bin/env node

/**
 * Enable uuid-ossp extension in PostgreSQL
 * This script must be run before prisma db push
 */

import pg from 'pg';
const { Client } = pg;

async function enableUuidExtension() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();

    console.log('🔧 Enabling uuid-ossp extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    console.log('✅ uuid-ossp extension enabled successfully!');

    // Verify extension is installed
    const result = await client.query(`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'uuid-ossp'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verified: uuid-ossp version', result.rows[0].extversion);
    }

  } catch (error) {
    console.error('❌ Error enabling extension:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

enableUuidExtension();
