import { ClientsRepository } from './clientsRepository.js';
import { encrypt, decrypt, generateApiKey, hashApiKey } from '../../services/encryptionService.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';
import { env } from '../../config/env.js';

const repo = new ClientsRepository();

export class ClientsService {
    /**
     * Register a new client/tenant.
     * Generates an API key and encrypts the WhatsApp access token.
     */
    async createClient({ name, whatsappBusinessId, whatsappPhoneNumberId, accessToken, systemPrompt, monthlyMessageLimit, monthlyTokenLimit }) {
        // Encrypt the access token before storage
        const accessTokenEncrypted = encrypt(accessToken);

        // Generate a unique API key for this client
        const apiKey = generateApiKey();
        const apiKeyHash = hashApiKey(apiKey);

        let client;
        try {
            client = await repo.create({
                name,
                whatsappBusinessId,
                whatsappPhoneNumberId,
                accessTokenEncrypted,
                systemPrompt: systemPrompt || 'You are a helpful WhatsApp assistant.',
                apiKeyHash,
                monthlyMessageLimit: monthlyMessageLimit || env.DEFAULT_MONTHLY_MESSAGE_LIMIT,
                monthlyTokenLimit: monthlyTokenLimit || env.DEFAULT_MONTHLY_TOKEN_LIMIT,
            });
        } catch (error) {
            if (error.code === '23505') {
                // Unique constraint violation
                throw new ConflictError('A client with this WhatsApp Business ID or Phone Number ID already exists');
            }
            throw error;
        }

        // Return the plain API key ONCE — it will never be retrievable again
        return { ...client, apiKey };
    }

    async getClientById(id) {
        const client = await repo.findById(id);
        if (!client) throw new NotFoundError('Client');
        // Never expose the encrypted token or key hash in API responses
        const { access_token_encrypted, api_key_hash, ...safe } = client;
        return safe;
    }

    async getClientWithToken(id) {
        const client = await repo.findById(id);
        if (!client) throw new NotFoundError('Client');
        return {
            ...client,
            accessToken: decrypt(client.access_token_encrypted),
        };
    }

    async getClientByPhoneNumberId(phoneNumberId) {
        const client = await repo.findByPhoneNumberId(phoneNumberId);
        if (!client) throw new NotFoundError('Client');
        return {
            ...client,
            accessToken: decrypt(client.access_token_encrypted),
        };
    }

    async listClients({ limit, offset } = {}) {
        return repo.findAll({ limit, offset });
    }

    async updateClient(id, updates) {
        const existing = await repo.findById(id);
        if (!existing) throw new NotFoundError('Client');

        const payload = {};
        if (updates.name) payload.name = updates.name;
        if (updates.systemPrompt) payload.systemPrompt = updates.systemPrompt;
        if (updates.accessToken) payload.accessTokenEncrypted = encrypt(updates.accessToken);
        if (updates.monthlyMessageLimit) payload.monthlyMessageLimit = updates.monthlyMessageLimit;
        if (updates.monthlyTokenLimit) payload.monthlyTokenLimit = updates.monthlyTokenLimit;
        if (updates.isActive !== undefined) payload.isActive = updates.isActive;

        const updated = await repo.update(id, payload);
        if (!updated) throw new NotFoundError('Client');
        return updated;
    }

    async deleteClient(id) {
        const deleted = await repo.delete(id);
        if (!deleted) throw new NotFoundError('Client');
        return { success: true };
    }

    async resetApiKey(id) {
        const existing = await repo.findById(id);
        if (!existing) throw new NotFoundError('Client');

        const apiKey = generateApiKey();
        const apiKeyHash = hashApiKey(apiKey);

        await repo.updateApiKeyHash(id, apiKeyHash);
        return { apiKey };
    }
}
