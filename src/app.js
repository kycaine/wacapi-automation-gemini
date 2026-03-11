import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { AppError } from './utils/errors.js';

// Route handlers
import { authMiddleware, adminAuthMiddleware } from './modules/auth/authMiddleware.js';
import * as clientsController from './modules/clients/clientsController.js';
import * as conversationsController from './modules/conversations/conversationsController.js';
import * as messagesController from './modules/messages/messagesController.js';
import * as webhookController from './modules/whatsapp/webhookController.js';
import { signatureMiddleware } from './modules/whatsapp/signatureMiddleware.js';

export async function buildApp() {
    const app = Fastify({
        logger: false, // We use pino directly
        trustProxy: true,
        // Capture raw body for webhook signature verification
        addContentTypeParser: false,
    });

    // ---- Raw body capture (required for HMAC signature verification) ----
    app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
        req.rawBody = body;
        try {
            done(null, JSON.parse(body));
        } catch (err) {
            done(err);
        }
    });

    // ---- Plugins ----
    await app.register(cors, {
        origin: env.NODE_ENV === 'production' ? false : true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });

    await app.register(rateLimit, {
        max: env.RATE_LIMIT_MAX,
        timeWindow: env.RATE_LIMIT_WINDOW_MS,
        keyGenerator: (request) =>
            request.headers['x-api-key'] || request.ip,
        errorResponseBuilder: () => ({
            success: false,
            error: 'Too many requests. Please slow down.',
            code: 'RATE_LIMIT_EXCEEDED',
        }),
    });

    await app.register(sensible);

    // ---- Health check (no auth) ----
    app.get('/health', async (request, reply) => {
        return reply.send({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
    });

    // ---- WhatsApp Webhook (no auth — uses signature verification) ----
    app.get('/webhook', webhookController.verifyWebhook);
    app.post('/webhook', {
        preHandler: [signatureMiddleware],
        handler: webhookController.receiveWebhook,
    });

    // ---- Admin Routes (admin token required) ----
    app.register(async (adminApp) => {
        adminApp.addHook('preHandler', adminAuthMiddleware);

        // Client management
        adminApp.post('/clients', clientsController.createClient);
        adminApp.get('/clients', clientsController.listClients);
        adminApp.get('/clients/:id', clientsController.getClient);
        adminApp.put('/clients/:id', clientsController.updateClient);
        adminApp.delete('/clients/:id', clientsController.deleteClient);
    }, { prefix: '/api/admin' });

    // ---- Authenticated API Routes (API key required) ----
    app.register(async (apiApp) => {
        apiApp.addHook('preHandler', authMiddleware);

        // Conversations
        apiApp.get('/conversations', conversationsController.listConversations);
        apiApp.get('/conversations/:id', conversationsController.getConversation);
        apiApp.post('/conversations/:id/human-takeover', conversationsController.enableHumanTakeover);
        apiApp.delete('/conversations/:id/human-takeover', conversationsController.disableHumanTakeover);

        // Messages
        apiApp.get('/conversations/:id/messages', messagesController.getMessages);

        // Usage
        apiApp.get('/usage', async (request, reply) => {
            const { UsageService } = await import('./modules/usage/usageService.js');
            const usageService = new UsageService();
            const current = await usageService.getCurrentUsage(request.client.id);
            const history = await usageService.getUsageHistory(request.client.id);
            return reply.send({ success: true, data: { current, history } });
        });

        // Knowledge Management
        const knowledgeRoutes = (await import('./modules/knowledge/index.js')).default;
        apiApp.register(knowledgeRoutes);
    }, { prefix: '/api' });

    // ---- Global Error Handler ----
    app.setErrorHandler((error, request, reply) => {
        // Log all errors
        logger.error({
            err: error,
            method: request.method,
            url: request.url,
            clientId: request.client?.id,
        }, 'Request error');

        // Operational errors (our custom errors)
        if (error instanceof AppError) {
            return reply.code(error.statusCode).send({
                success: false,
                error: error.message,
                code: error.code,
                ...(error.details ? { details: error.details } : {}),
            });
        }

        // Fastify validation errors
        if (error.validation) {
            return reply.code(400).send({
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: error.validation,
            });
        }

        // Rate limit errors (from @fastify/rate-limit)
        if (error.statusCode === 429) {
            return reply.code(429).send({
                success: false,
                error: error.message,
                code: 'RATE_LIMIT_EXCEEDED',
            });
        }

        // Unknown errors — don't leak internals in production
        const statusCode = error.statusCode || 500;
        return reply.code(statusCode).send({
            success: false,
            error: env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
            code: 'INTERNAL_ERROR',
        });
    });

    // ---- 404 Handler ----
    app.setNotFoundHandler((request, reply) => {
        return reply.code(404).send({
            success: false,
            error: `Route ${request.method} ${request.url} not found`,
            code: 'NOT_FOUND',
        });
    });

    return app;
}
