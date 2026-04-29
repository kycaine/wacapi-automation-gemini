import { query } from '../../database/index.js';
import { encrypt, decrypt } from '../../services/encryptionService.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';
import { generateApiKey, hashApiKey } from '../../services/encryptionService.js';
import { sanitizeString } from '../../utils/sanitize.js';

export class ClientsRepository {
    async findById(id) {
        const result = await query(
            `SELECT id, name, whatsapp_business_id, whatsapp_phone_number_id,
              access_token_encrypted, system_prompt, api_key_hash,
              monthly_message_limit, monthly_token_limit, is_active,
              created_at, updated_at
       FROM clients WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }

    async findByPhoneNumberId(phoneNumberId) {
        console.log(`[DEBUG_DB] Finding client with phoneNumberId: "${phoneNumberId}" (type: ${typeof phoneNumberId}, length: ${phoneNumberId?.length})`);
        const result = await query(
            `SELECT id, name, whatsapp_business_id, whatsapp_phone_number_id,
              access_token_encrypted, system_prompt, monthly_message_limit,
              monthly_token_limit, is_active
       FROM clients
       WHERE whatsapp_phone_number_id = $1 AND is_active = TRUE
       LIMIT 1`,
            [phoneNumberId]
        );
        console.log(`[DEBUG_DB] Found client: ${result.rows.length > 0 ? result.rows[0].id : 'NULL'}`);
        return result.rows[0] || null;
    }

    async findAll({ limit = 20, offset = 0 } = {}) {
        const result = await query(
            `SELECT id, name, whatsapp_business_id, whatsapp_phone_number_id,
              monthly_message_limit, monthly_token_limit, is_active,
              created_at, updated_at
       FROM clients
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return result.rows;
    }

    async create({ name, whatsappBusinessId, whatsappPhoneNumberId, accessTokenEncrypted, systemPrompt, apiKeyHash, monthlyMessageLimit, monthlyTokenLimit }) {
        const result = await query(
            `INSERT INTO clients
         (name, whatsapp_business_id, whatsapp_phone_number_id,
          access_token_encrypted, system_prompt, api_key_hash,
          monthly_message_limit, monthly_token_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, whatsapp_business_id, whatsapp_phone_number_id,
                 system_prompt, monthly_message_limit, monthly_token_limit,
                 is_active, created_at`,
            [name, whatsappBusinessId, whatsappPhoneNumberId, accessTokenEncrypted, systemPrompt, apiKeyHash, monthlyMessageLimit, monthlyTokenLimit]
        );
        return result.rows[0];
    }

    async update(id, { name, systemPrompt, accessTokenEncrypted, monthlyMessageLimit, monthlyTokenLimit, isActive }) {
        const fields = [];
        const values = [];
        let idx = 1;

        if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
        if (systemPrompt !== undefined) { fields.push(`system_prompt = $${idx++}`); values.push(systemPrompt); }
        if (accessTokenEncrypted !== undefined) { fields.push(`access_token_encrypted = $${idx++}`); values.push(accessTokenEncrypted); }
        if (monthlyMessageLimit !== undefined) { fields.push(`monthly_message_limit = $${idx++}`); values.push(monthlyMessageLimit); }
        if (monthlyTokenLimit !== undefined) { fields.push(`monthly_token_limit = $${idx++}`); values.push(monthlyTokenLimit); }
        if (isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(isActive); }

        if (fields.length === 0) return null;

        values.push(id);
        const result = await query(
            `UPDATE clients SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, name, whatsapp_business_id, whatsapp_phone_number_id,
                 system_prompt, monthly_message_limit, monthly_token_limit,
                 is_active, updated_at`,
            values
        );
        return result.rows[0] || null;
    }

    async delete(id) {
        const result = await query(
            'DELETE FROM clients WHERE id = $1 RETURNING id',
            [id]
        );
        return result.rowCount > 0;
    }

    async updateApiKeyHash(id, apiKeyHash) {
        const result = await query(
            'UPDATE clients SET api_key_hash = $2, updated_at = NOW() WHERE id = $1 RETURNING id',
            [id, apiKeyHash]
        );
        return result.rowCount > 0;
    }
}
