import { ClientsService } from './clientsService.js';
import { ValidationError } from '../../utils/errors.js';
import { z } from 'zod';

const service = new ClientsService();

const createClientSchema = z.object({
    name: z.string().min(1).max(255),
    whatsapp_business_id: z.string().min(1),
    whatsapp_phone_number_id: z.string().min(1),
    access_token: z.string().min(1),
    system_prompt: z.string().optional(),
    monthly_message_limit: z.number().int().positive().optional(),
    monthly_token_limit: z.number().int().positive().optional(),
});

const updateClientSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    system_prompt: z.string().optional(),
    access_token: z.string().min(1).optional(),
    monthly_message_limit: z.number().int().positive().optional(),
    monthly_token_limit: z.number().int().positive().optional(),
    is_active: z.boolean().optional(),
});

export async function createClient(request, reply) {
    const parsed = createClientSchema.safeParse(request.body);
    if (!parsed.success) {
        throw new ValidationError('Invalid request body', parsed.error.flatten());
    }

    const { name, whatsapp_business_id, whatsapp_phone_number_id, access_token, system_prompt, monthly_message_limit, monthly_token_limit } = parsed.data;

    const result = await service.createClient({
        name,
        whatsappBusinessId: whatsapp_business_id,
        whatsappPhoneNumberId: whatsapp_phone_number_id,
        accessToken: access_token,
        systemPrompt: system_prompt,
        monthlyMessageLimit: monthly_message_limit,
        monthlyTokenLimit: monthly_token_limit,
    });

    return reply.code(201).send({
        success: true,
        data: result,
        message: 'Client created. Save the apiKey — it will not be shown again.',
    });
}

export async function listClients(request, reply) {
    const limit = Math.min(parseInt(request.query.limit) || 20, 100);
    const offset = parseInt(request.query.offset) || 0;
    const clients = await service.listClients({ limit, offset });
    return reply.send({ success: true, data: clients });
}

export async function getClient(request, reply) {
    const client = await service.getClientById(request.params.id);
    return reply.send({ success: true, data: client });
}

export async function updateClient(request, reply) {
    const parsed = updateClientSchema.safeParse(request.body);
    if (!parsed.success) {
        throw new ValidationError('Invalid request body', parsed.error.flatten());
    }

    const { name, system_prompt, access_token, monthly_message_limit, monthly_token_limit, is_active } = parsed.data;

    const updated = await service.updateClient(request.params.id, {
        name,
        systemPrompt: system_prompt,
        accessToken: access_token,
        monthlyMessageLimit: monthly_message_limit,
        monthlyTokenLimit: monthly_token_limit,
        isActive: is_active,
    });

    return reply.send({ success: true, data: updated });
}

export async function deleteClient(request, reply) {
    await service.deleteClient(request.params.id);
    return reply.code(204).send();
}
