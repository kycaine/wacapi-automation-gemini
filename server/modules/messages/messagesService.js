import { MessagesRepository } from './messagesRepository.js';

const repo = new MessagesRepository();

export class MessagesService {
    async saveMessage({ conversationId, clientId, role, content, tokensUsed = 0, waMessageId = null }) {
        return repo.create({ conversationId, clientId, role, content, tokensUsed, waMessageId });
    }

    async getConversationHistory(conversationId, limit = 50) {
        return repo.findByConversationId(conversationId, { limit });
    }

    async getRecentHistory(conversationId, limit = 50) {
        return repo.findRecentByConversationId(conversationId, limit);
    }

    async isMessageProcessed(waMessageId) {
        return repo.isMessageProcessed(waMessageId);
    }

    async markMessageProcessed(waMessageId, clientId) {
        return repo.markMessageProcessed(waMessageId, clientId);
    }
}
