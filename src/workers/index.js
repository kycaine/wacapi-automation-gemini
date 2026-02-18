import { createMessageWorker } from './messageWorker.js';
import { logger } from '../utils/logger.js';

const workers = [];

export function startWorkers() {
    logger.info('Starting all workers...');
    workers.push(createMessageWorker());
    logger.info(`${workers.length} worker(s) started`);
}

export async function stopWorkers() {
    logger.info('Gracefully stopping workers...');
    await Promise.all(workers.map((w) => w.close()));
    logger.info('All workers stopped');
}
