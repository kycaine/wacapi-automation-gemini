import { env } from './env.js';

const connectionConfig = env.REDIS_URL || {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    db: env.REDIS_DB,
};

export const redisConfig = {
    ...(typeof connectionConfig === 'string' ? { url: connectionConfig } : connectionConfig),
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
};

// BullMQ can take a connection string or a connection object
export const bullMQConnection = connectionConfig;
