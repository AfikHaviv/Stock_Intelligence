import pg from 'pg';
import 'dotenv/config';

const { Pool, types } = pg;

// Return bigint columns as JS numbers (safe for stock volumes well under Number.MAX_SAFE_INTEGER)
types.setTypeParser(20, (val: string) => parseInt(val, 10));

// Neon (and other hosted Postgres providers) require SSL.
// Set DATABASE_SSL=true in the production environment to enable it.
export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
