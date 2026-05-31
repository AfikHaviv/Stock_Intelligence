import pg from 'pg';
import 'dotenv/config';

const { Pool, types } = pg;

// Return bigint columns as JS numbers (safe for stock volumes well under Number.MAX_SAFE_INTEGER)
types.setTypeParser(20, (val: string) => parseInt(val, 10));

export const db = new Pool({ connectionString: process.env.DATABASE_URL });
