import { query } from '../../database/index.js';

export class UsageRepository {
    /**
     * Atomically increment usage counters for the current month.
     * Uses UPSERT to handle first-time month creation.
     */
    async incrementUsage(clientId, messageCount = 1, tokenCount = 0) {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const month = monthStart.toISOString().split('T')[0];

        const result = await query(
            `INSERT INTO usage_stats (client_id, month, message_count, token_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (client_id, month) DO UPDATE
         SET message_count = usage_stats.message_count + EXCLUDED.message_count,
             token_count   = usage_stats.token_count + EXCLUDED.token_count,
             updated_at    = NOW()
       RETURNING *`,
            [clientId, month, messageCount, tokenCount]
        );
        return result.rows[0];
    }

    async getCurrentMonthUsage(clientId) {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const month = monthStart.toISOString().split('T')[0];

        const result = await query(
            `SELECT message_count, token_count, month
       FROM usage_stats
       WHERE client_id = $1 AND month = $2`,
            [clientId, month]
        );
        return result.rows[0] || { message_count: 0, token_count: 0, month };
    }

    async getUsageHistory(clientId, months = 12) {
        const result = await query(
            `SELECT month, message_count, token_count
       FROM usage_stats
       WHERE client_id = $1
       ORDER BY month DESC
       LIMIT $2`,
            [clientId, months]
        );
        return result.rows;
    }
}
