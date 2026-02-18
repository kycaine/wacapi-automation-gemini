/**
 * Base application error class.
 * All custom errors extend this.
 */
export class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

export class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403, 'FORBIDDEN');
    }
}

export class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT');
    }
}

export class UsageLimitError extends AppError {
    constructor(message = 'Monthly usage limit exceeded') {
        super(message, 429, 'USAGE_LIMIT_EXCEEDED');
    }
}

export class ExternalServiceError extends AppError {
    constructor(service, message) {
        super(`${service} error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
        this.service = service;
    }
}
