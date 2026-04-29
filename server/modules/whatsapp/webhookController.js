import { Queue } from 'bullmq';
import { bullMQConnection } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { WhatsAppService } from './whatsappService.js';
import { signatureMiddleware } from './signatureMiddleware.js';
import { logger } from '../../utils/logger.js';

const whatsappService = new WhatsAppService();
let messageQueue;

function getQueue() {
    if (!messageQueue) {
        messageQueue = new Queue(env.QUEUE_NAME, { connection: bullMQConnection });
    }
    return messageQueue;
}

/**
 * GET /webhook — Meta webhook verification challenge.
 * Meta sends this when you first configure the webhook URL.
 */
export async function verifyWebhook(request, reply) {
    const mode = request.query['hub.mode'];
    const token = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    if (mode === 'subscribe' && token === env.WEBHOOK_VERIFY_TOKEN) {
        logger.info('WhatsApp webhook verified successfully');
        return reply.code(200).send(challenge);
    }

    return reply.code(403).send({ error: 'Verification failed' });
}

/**
 * POST /webhook — Receive incoming WhatsApp messages.
 * Validates signature, extracts message, pushes to queue.
 */
export async function receiveWebhook(request, reply) {
    // Always respond 200 immediately to Meta (within 20s requirement)
    reply.code(200).send({ status: 'received' });

    const messageData = whatsappService.extractMessageData(request.body);

    if (!messageData) {
        logger.debug({ body: request.body }, 'Webhook received but no processable message found');
        return;
    }

    logger.info({
        from: messageData.from,
        phoneNumberId: messageData.phoneNumberId,
        waMessageId: messageData.waMessageId,
    }, 'Incoming WhatsApp message queued');

    try {
        const queue = getQueue();
        await queue.add(
            'process-message',
            messageData,
            {
                attempts: env.QUEUE_MAX_RETRIES,
                backoff: {
                    type: 'exponential',
                    delay: env.QUEUE_RETRY_DELAY_MS,
                },
                removeOnComplete: { count: 1000 },
                removeOnFail: { count: 500 },
            }
        );
    } catch (error) {
        logger.error({ err: error, messageData }, 'Failed to enqueue message');
    }
}

export { signatureMiddleware };
