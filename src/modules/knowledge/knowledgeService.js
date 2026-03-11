import { query } from '../../database/index.js';
import { AIService } from '../ai/aiService.js';
import { logger } from '../../utils/logger.js';

const aiService = new AIService();

export class KnowledgeService {
    /**
     * Create a new knowledge entry.
     * If type is 'rag', an embedding is automatically generated.
     */
    async createKnowledge({ clientId, title, content, typeKnowledge }) {
        let embedding = null;

        if (typeKnowledge === 'rag') {
            embedding = await aiService.embedText(content);
        }

        const result = await query(
            `INSERT INTO knowledge (client_id, title, content, type_knowledge, embedding)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, title, type_knowledge, created_at`,
            [clientId, title, content, typeKnowledge, embedding ? `[${embedding.join(',')}]` : null]
        );

        return result.rows[0];
    }

    /**
     * Get all knowledge for a specific client.
     */
    async listKnowledge(clientId) {
        const result = await query(
            `SELECT id, title, type_knowledge, created_at, updated_at
             FROM knowledge
             WHERE client_id = $1
             ORDER BY created_at DESC`,
            [clientId]
        );
        return result.rows;
    }

    /**
     * Delete knowledge entry.
     */
    async deleteKnowledge(id, clientId) {
        await query(
            'DELETE FROM knowledge WHERE id = $1 AND client_id = $2',
            [id, clientId]
        );
    }

    /**
     * Retrieve prompt-based knowledge for a client.
     */
    async getPromptKnowledge(clientId) {
        const result = await query(
            `SELECT content FROM knowledge 
             WHERE client_id = $1 AND type_knowledge = 'prompt'
             ORDER BY created_at ASC`,
            [clientId]
        );
        return result.rows.map(r => r.content).join('\n\n');
    }

    /**
     * Perform RAG similarity search.
     * Returns the most relevant knowledge pieces.
     */
    async searchRelevantKnowledge(clientId, queryText, limit = 3) {
        try {
            // Check if client even has RAG knowledge to avoid unnecessary embedding calls
            const countResult = await query(
                'SELECT 1 FROM knowledge WHERE client_id = $1 AND type_knowledge = "rag" LIMIT 1',
                [clientId]
            );

            if (countResult.rowCount === 0) {
                return [];
            }

            const queryEmbedding = await aiService.embedText(queryText);

            // Using pgvector cosine distance operator <=>
            const result = await query(
                `SELECT content, 1 - (embedding <=> $1) as similarity
                 FROM knowledge
                 WHERE client_id = $2 AND type_knowledge = 'rag' AND embedding IS NOT NULL
                 ORDER BY embedding <=> $1
                 LIMIT $3`,
                [`[${queryEmbedding.join(',')}]`, clientId, limit]
            );

            return result.rows;
        } catch (error) {
            logger.error({ err: error, clientId }, 'RAG search failed');
            return [];
        }
    }
}
