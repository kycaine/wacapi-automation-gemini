import { query } from '../../database/index.js';

export class MessagesRepository {
    async create({ conversationId, clientId, role, content, tokensUsed = 0, waMessageId = null }) {
        const result = await query(
            `INSERT INTO messages (conversation_id, client_id, role, content, tokens_used, wa_message_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [conversationId, clientId, role, content, tokensUsed, waMessageId]
        );
        return result.rows[0];
    }

    /**
     * Load conversation history ordered oldest-first (for AI context).
     * Excludes system messages from history.
     */
    async findByConversationId(conversationId, { limit = 50, offset = 0 } = {}) {
        const result = await query(
            `SELECT id, role, content, tokens_used, created_at
       FROM messages
       WHERE conversation_id = $1 AND role != 'system'
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
            [conversationId, limit, offset]
        );
        return result.rows;
    }

    /**
     * Load the most recent N messages for AI history (newest first, then reversed by caller).
     */
    async findRecentByConversationId(conversationId, limit = 50) {
        const result = await query(
            `SELECT id, role, content, tokens_used, created_at
       FROM messages
       WHERE conversation_id = $1 AND role != 'system'
       ORDER BY created_at DESC
       LIMIT $2`,
            [conversationId, limit]
        );
        // Return in chronological order
        return result.rows.reverse();
    }

    async isMessageProcessed(waMessageId) {
        const result = await query(
            'SELECT wa_message_id FROM processed_messages WHERE wa_message_id = $1',
            [waMessageId]
        );
        return result.rowCount > 0;
    }

    async markMessageProcessed(waMessageId, clientId) {
        await query(
            `INSERT INTO processed_messages (wa_message_id, client_id)
       VALUES ($1, $2)
       ON CONFLICT (wa_message_id) DO NOTHING`,
            [waMessageId, clientId]
        );
    }
}
