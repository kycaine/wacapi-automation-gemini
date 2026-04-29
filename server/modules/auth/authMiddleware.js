import { query } from '../../database/index.js';
import { hashApiKey } from '../../services/encryptionService.js';
import { UnauthorizedError } from '../../utils/errors.js';

/**
 * Fastify preHandler hook for API key authentication.
 * Attaches the authenticated client to request.client.
 */
export async function authMiddleware(request, reply) {
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
        throw new UnauthorizedError('Missing X-API-Key header');
    }

    const keyHash = hashApiKey(apiKey);

    const result = await query(
        `SELECT id, name, whatsapp_business_id, whatsapp_phone_number_id,
            monthly_message_limit, monthly_token_limit, is_active
     FROM clients
     WHERE api_key_hash = $1 AND is_active = TRUE
     LIMIT 1`,
        [keyHash]
    );

    if (result.rowCount === 0) {
        throw new UnauthorizedError('Invalid or inactive API key');
    }

    request.client = result.rows[0];
}

import { env } from '../../config/env.js';

/**
 * Admin-only middleware — validates a static admin token from env.
 * Used for client registration endpoints.
 */
export async function adminAuthMiddleware(request, reply) {
    const token = request.headers['x-admin-token'];
    const adminToken = env.ADMIN_TOKEN;

    if (!adminToken) {
        throw new Error('ADMIN_TOKEN not configured');
    }

    if (!token || token !== adminToken) {
        throw new UnauthorizedError('Invalid admin token');
    }
}
