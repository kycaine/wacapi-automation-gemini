import { KnowledgeService } from './knowledgeService.js';
import { ValidationError } from '../../utils/errors.js';

const knowledgeService = new KnowledgeService();

export async function createKnowledge(request, reply) {
    const { title, content, type_knowledge } = request.body;
    const clientId = request.client.id;

    if (!title || !content || !type_knowledge) {
        throw new ValidationError('title, content, and type_knowledge are required');
    }

    if (!['rag', 'prompt'].includes(type_knowledge)) {
        throw new ValidationError('type_knowledge must be either "rag" or "prompt"');
    }

    const data = await knowledgeService.createKnowledge({
        clientId,
        title,
        content,
        typeKnowledge: type_knowledge
    });

    return reply.code(201).send({
        success: true,
        data
    });
}

export async function listKnowledge(request, reply) {
    const clientId = request.client.id;
    const data = await knowledgeService.listKnowledge(clientId);
    return reply.send({ success: true, data });
}

export async function deleteKnowledge(request, reply) {
    const { id } = request.params;
    const clientId = request.client.id;
    await knowledgeService.deleteKnowledge(id, clientId);
    return reply.send({ success: true, message: 'Knowledge deleted' });
}
