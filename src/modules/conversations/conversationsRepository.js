import { query } from '../../database/index.js';

export class ConversationsRepository {
    /**
     * Find or create a conversation for a given client + phone number.
     * Uses INSERT ... ON CONFLICT to ensure atomicity.
     */
    async findOrCreate(clientId, waNumber) {
        const result = await query(
            `INSERT INTO conversations (client_id, wa_number)
       VALUES ($1, $2)
       ON CONFLICT (client_id, wa_number) DO UPDATE
         SET updated_at = NOW()
       RETURNING *`,
            [clientId, waNumber]
        );
        return result.rows[0];
    }

    async findById(id, clientId) {
        const result = await query(
            `SELECT * FROM conversations
       WHERE id = $1 AND client_id = $2`,
            [id, clientId]
        );
        return result.rows[0] || null;
    }

    async findByClientId(clientId, { limit = 20, offset = 0 } = {}) {
        const result = await query(
            `SELECT id, client_id, wa_number, state, is_human_active, metadata, created_at, updated_at
       FROM conversations
       WHERE client_id = $1
       ORDER BY updated_at DESC
       LIMIT $2 OFFSET $3`,
            [clientId, limit, offset]
        );
        return result.rows;
    }

    async updateState(id, clientId, state) {
        const result = await query(
            `UPDATE conversations
       SET state = $1, updated_at = NOW()
       WHERE id = $2 AND client_id = $3
       RETURNING *`,
            [state, id, clientId]
        );
        return result.rows[0] || null;
    }

    async setHumanActive(id, clientId, isHumanActive) {
        const result = await query(
            `UPDATE conversations
       SET is_human_active = $1, updated_at = NOW()
       WHERE id = $2 AND client_id = $3
       RETURNING *`,
            [isHumanActive, id, clientId]
        );
        return result.rows[0] || null;
    }

    async updateMetadata(id, clientId, metadata) {
        const result = await query(
            `UPDATE conversations
       SET metadata = metadata || $1::jsonb, updated_at = NOW()
       WHERE id = $2 AND client_id = $3
       RETURNING *`,
            [JSON.stringify(metadata), id, clientId]
        );
        return result.rows[0] || null;
    }
}
