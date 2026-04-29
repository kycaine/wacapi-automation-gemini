import * as knowledgeController from './knowledgeController.js';

export default async function (fastify) {
    fastify.post('/knowledge', knowledgeController.createKnowledge);
    fastify.get('/knowledge', knowledgeController.listKnowledge);
    fastify.delete('/knowledge/:id', knowledgeController.deleteKnowledge);
}
