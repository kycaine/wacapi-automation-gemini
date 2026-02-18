/**
 * Sanitize a string by removing null bytes and trimming whitespace.
 */
export function sanitizeString(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/\0/g, '').trim();
}

/**
 * Sanitize a phone number to digits only (with optional leading +).
 */
export function sanitizePhoneNumber(phone) {
    if (typeof phone !== 'string') return phone;
    return phone.replace(/[^\d+]/g, '');
}

/**
 * Recursively sanitize all string values in an object.
 */
export function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeObject);

    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [
            k,
            typeof v === 'string' ? sanitizeString(v) : sanitizeObject(v),
        ])
    );
}

/**
 * Truncate a string to a maximum length.
 */
export function truncate(str, maxLength) {
    if (typeof str !== 'string') return str;
    return str.length > maxLength ? str.slice(0, maxLength) : str;
}
