import { GeminiProvider } from './geminiProvider.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

// Singleton provider instance — swap this to change the LLM
const provider = new GeminiProvider();

export class AIService {
    /**
     * Generate an AI response with token-aware history truncation.
     *
     * History is truncated from the oldest end to fit within the token budget,
     * ensuring we always include the most recent context.
     *
     * @param {Object} params
     * @param {string} params.systemPrompt - Client's system prompt
     * @param {Array<{role: string, content: string, tokens_used: number}>} params.fullHistory - All messages
     * @param {string} params.userInput - Current user message
     * @param {string} [params.additionalContext] - Optional RAG/Prompt context
     * @returns {Promise<{text: string, tokensUsed: number}>}
     */
    async generateResponse({ systemPrompt, fullHistory, userInput, additionalContext }) {
        const finalSystemPrompt = additionalContext
            ? `${systemPrompt}\n\n[CONTEXT KNOWLEDGE]\n${additionalContext}`
            : systemPrompt;

        const truncatedHistory = this._truncateHistoryByTokens(
            fullHistory,
            userInput,
            finalSystemPrompt
        );

        logger.debug({
            provider: provider.name,
            fullHistoryLength: fullHistory.length,
            truncatedHistoryLength: truncatedHistory.length,
        }, 'AI history truncated');

        return provider.generateResponse({
            systemPrompt: finalSystemPrompt,
            conversationHistory: truncatedHistory,
            userInput,
        });
    }

    /**
     * Proxy to generate embedding via provider.
     */
    async embedText(text) {
        return provider.embedText(text);
    }

    /**
     * Truncate conversation history to fit within the token budget.
     * Removes oldest messages first, always keeping the most recent context.
     *
     * @param {Array} history - All messages (oldest first)
     * @param {string} userInput - Current user message
     * @param {string} systemPrompt - System prompt
     * @returns {Array} - Truncated history
     */
    _truncateHistoryByTokens(history, userInput, systemPrompt) {
        const maxHistoryTokens = env.GEMINI_MAX_HISTORY_TOKENS;

        // Reserve tokens for system prompt and current user input
        const systemTokens = provider.estimateTokens(systemPrompt);
        const userInputTokens = provider.estimateTokens(userInput);
        const overhead = 200; // Buffer for formatting, role labels, etc.
        const availableTokens = maxHistoryTokens - systemTokens - userInputTokens - overhead;

        if (availableTokens <= 0) return [];

        // Walk history from newest to oldest, accumulating until budget is exhausted
        let tokenBudget = availableTokens;
        const selected = [];

        for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];
            const msgTokens = msg.tokens_used > 0
                ? msg.tokens_used
                : provider.estimateTokens(msg.content);

            if (tokenBudget - msgTokens < 0) break;

            tokenBudget -= msgTokens;
            selected.unshift(msg); // Prepend to maintain chronological order
        }

        return selected;
    }

    /**
     * Get the current provider name (for logging/debugging).
     */
    get providerName() {
        return provider.name;
    }
}
