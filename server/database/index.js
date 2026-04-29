import { pool } from '../config/database.js';

/**
 * Execute a parameterized query against the pool.
 * @param {string} text - SQL query string
 * @param {Array} [params] - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.LOG_LEVEL === 'debug') {
            console.debug({ query: text, duration, rows: result.rowCount });
        }
        return result;
    } catch (error) {
        error.query = text;
        throw error;
    }
}

/**
 * Get a client from the pool for transactions.
 * Remember to call client.release() when done.
 * @returns {Promise<import('pg').PoolClient>}
 */
export async function getClient() {
    return pool.connect();
}

/**
 * Execute a function within a transaction.
 * Automatically commits on success, rolls back on error.
 * @param {function(import('pg').PoolClient): Promise<any>} fn
 * @returns {Promise<any>}
 */
export async function withTransaction(fn) {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export { pool };
