import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const connectionConfig = env.DATABASE_URL ? {
    connectionString: env.DATABASE_URL,
} : {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
};

export const pool = new Pool({
    ...connectionConfig,
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
});
