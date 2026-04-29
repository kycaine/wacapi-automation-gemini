import axios from 'axios';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ExternalServiceError } from '../../utils/errors.js';

const GRAPH_API_BASE = `https://graph.facebook.com/${env.META_API_VERSION}`;

export class WhatsAppService {
    /**
     * Send a text message via the WhatsApp Business Cloud API.
     *
     * @param {string} phoneNumberId - Sender's WhatsApp Phone Number ID
     * @param {string} accessToken - Client's decrypted access token
     * @param {string} to - Recipient phone number (e.g. "628123456789")
     * @param {string} text - Message text
     * @returns {Promise<{messageId: string}>}
     */
    async sendTextMessage(phoneNumberId, accessToken, to, text) {
        try {
            const response = await axios.post(
                `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to,
                    type: 'text',
                    text: { body: text, preview_url: false },
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 10000,
                }
            );

            const messageId = response.data?.messages?.[0]?.id;
            logger.info({ phoneNumberId, to, messageId }, 'WhatsApp message sent');
            return { messageId };
        } catch (error) {
            const status = error.response?.status;
            const detail = error.response?.data?.error?.message || error.message;

            logger.error({ err: error, phoneNumberId, to, status }, 'Failed to send WhatsApp message');

            if (status === 401) throw new ExternalServiceError('WhatsApp', 'Invalid or expired access token');
            if (status === 400) throw new ExternalServiceError('WhatsApp', `Bad request: ${detail}`);
            if (status === 429) throw new ExternalServiceError('WhatsApp', 'Rate limit exceeded');

            throw new ExternalServiceError('WhatsApp', detail || 'Failed to send message');
        }
    }

    /**
     * Mark a message as read (sends read receipt).
     */
    async markAsRead(phoneNumberId, accessToken, messageId) {
        try {
            await axios.post(
                `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: messageId,
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 5000,
                }
            );
        } catch (error) {
            // Non-critical — log but don't throw
            logger.warn({ err: error, messageId }, 'Failed to mark message as read');
        }
    }

    /**
     * Extract the relevant message data from a Meta webhook payload.
     * Returns null if the payload doesn't contain a processable text message.
     */
    extractMessageData(webhookBody) {
        try {
            const entry = webhookBody?.entry?.[0];
            const change = entry?.changes?.[0];
            const value = change?.value;

            if (!value?.messages?.length) return null;

            const message = value.messages[0];
            if (message.type !== 'text') return null; // Only handle text for now

            return {
                waMessageId: message.id,
                from: message.from,
                text: message.text?.body || '',
                timestamp: message.timestamp,
                phoneNumberId: value.metadata?.phone_number_id,
                displayPhoneNumber: value.metadata?.display_phone_number,
            };
        } catch {
            return null;
        }
    }
}
