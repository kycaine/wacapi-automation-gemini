import { ConversationsService } from './conversationsService.js';
import { ValidationError } from '../../utils/errors.js';
import { z } from 'zod';

const service = new ConversationsService();

export async function listConversations(request, reply) {
    const limit = Math.min(parseInt(request.query.limit) || 20, 100);
    const offset = parseInt(request.query.offset) || 0;
    const search = request.query.q || '';
    const conversations = await service.listConversations(request.client.id, { limit, offset, search });
    return reply.send({ success: true, data: conversations });
}

export async function getConversation(request, reply) {
    const conv = await service.getConversationById(request.params.id, request.client.id);
    return reply.send({ success: true, data: conv });
}

export async function enableHumanTakeover(request, reply) {
    const conv = await service.enableHumanTakeover(request.params.id, request.client.id);
    return reply.send({ success: true, data: conv, message: 'Human takeover enabled. AI responses paused.' });
}

export async function disableHumanTakeover(request, reply) {
    const conv = await service.disableHumanTakeover(request.params.id, request.client.id);
    return reply.send({ success: true, data: conv, message: 'Human takeover disabled. AI responses resumed.' });
}
