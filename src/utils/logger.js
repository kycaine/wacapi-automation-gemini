import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
    level: env.LOG_LEVEL,
    transport:
        env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                },
            }
            : undefined,
    base: {
        env: env.NODE_ENV,
        service: 'wacapi',
    },
    redact: {
        paths: [
            'access_token',
            'access_token_encrypted',
            'api_key_hash',
            'req.headers.authorization',
            'req.headers["x-api-key"]',
        ],
        censor: '[REDACTED]',
    },
});
