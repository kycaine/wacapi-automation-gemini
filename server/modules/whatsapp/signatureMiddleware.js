import { verifyWebhookSignature } from '../../services/encryptionService.js';
import { UnauthorizedError } from '../../utils/errors.js';

/**
 * Fastify preHandler hook to validate Meta webhook HMAC-SHA256 signature.
 * Must run AFTER raw body has been captured.
 */
export async function signatureMiddleware(request, reply) {
    const signature = request.headers['x-hub-signature-256'];

    if (!signature) {
        throw new UnauthorizedError('Missing X-Hub-Signature-256 header');
    }

    // rawBody is attached by the content-type parser in app.js
    const rawBody = request.rawBody;
    if (!rawBody) {
        throw new UnauthorizedError('Cannot verify signature: raw body unavailable');
    }

    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
        throw new UnauthorizedError('Invalid webhook signature');
    }
}
