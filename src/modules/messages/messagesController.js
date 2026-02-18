import { MessagesService } from './messagesService.js';

const service = new MessagesService();

export async function getMessages(request, reply) {
    const { id: conversationId } = request.params;
    const limit = Math.min(parseInt(request.query.limit) || 50, 200);
    const offset = parseInt(request.query.offset) || 0;

    const messages = await service.getConversationHistory(conversationId, limit);
    return reply.send({ success: true, data: messages });
}
