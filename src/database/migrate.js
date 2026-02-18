import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from '../config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Run the database migration (schema.sql).
 * Safe to run multiple times — uses IF NOT EXISTS guards.
 */
export async function runMigrations() {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    const client = await pool.connect();
    try {
        console.log('🗄  Running database migrations...');
        await client.query(schema);
        console.log('✅ Database migrations complete.');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
}
