import { buildApp } from './app.js';
import { runMigrations } from './database/migrate.js';
import { startWorkers, stopWorkers } from './workers/index.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { pool } from './config/database.js';

async function start() {
    logger.info({ env: env.NODE_ENV, port: env.PORT }, 'Starting WA Automation SaaS...');

    // Run DB migrations
    await runMigrations();

    // Build Fastify app
    const app = await buildApp();

    // Start BullMQ workers
    startWorkers();

    // Start HTTP server
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info({ port: env.PORT }, `[RUN] Server listening on port ${env.PORT}`);

    // ---- Graceful Shutdown ----
    const shutdown = async (signal) => {
        logger.info({ signal }, 'Shutdown signal received');

        try {
            await app.close();
            logger.info('HTTP server closed');

            await stopWorkers();
            logger.info('Workers stopped');

            await pool.end();
            logger.info('Database pool closed');

            logger.info('Graceful shutdown complete');
            process.exit(0);
        } catch (error) {
            logger.error({ err: error }, 'Error during shutdown');
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
        logger.fatal({ err: error }, 'Uncaught exception');
        process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
        logger.fatal({ reason }, 'Unhandled promise rejection');
        process.exit(1);
    });
}

start().catch((error) => {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
});
