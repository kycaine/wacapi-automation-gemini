import { ConversationsRepository } from './conversationsRepository.js';
import { NotFoundError } from '../../utils/errors.js';

const repo = new ConversationsRepository();

export class ConversationsService {
    async getOrCreateConversation(clientId, waNumber) {
        return repo.findOrCreate(clientId, waNumber);
    }

    async getConversationById(id, clientId) {
        const conv = await repo.findById(id, clientId);
        if (!conv) throw new NotFoundError('Conversation');
        return conv;
    }

    async listConversations(clientId, { limit, offset, search } = {}) {
        return repo.findByClientId(clientId, { limit, offset, search });
    }

    async transitionState(id, clientId, newState) {
        const conv = await repo.updateState(id, clientId, newState);
        if (!conv) throw new NotFoundError('Conversation');
        return conv;
    }

    async enableHumanTakeover(id, clientId) {
        const conv = await repo.setHumanActive(id, clientId, true);
        if (!conv) throw new NotFoundError('Conversation');
        return conv;
    }

    async disableHumanTakeover(id, clientId) {
        const conv = await repo.setHumanActive(id, clientId, false);
        if (!conv) throw new NotFoundError('Conversation');
        return conv;
    }
}
