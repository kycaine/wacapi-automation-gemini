/**
 * Abstract LLM Provider Interface.
 * All LLM providers must implement this contract.
 *
 * This enables swapping Gemini for OpenAI, Anthropic, etc.
 * without changing any business logic.
 */
export class LLMProvider {
    /**
     * Generate a response from the LLM.
     *
     * @param {Object} params
     * @param {string} params.systemPrompt - The system instruction for the AI
     * @param {Array<{role: 'user'|'model', parts: [{text: string}]}>} params.conversationHistory - Prior messages
     * @param {string} params.userInput - The latest user message
     * @returns {Promise<{text: string, tokensUsed: number, promptTokens: number, completionTokens: number}>}
     */
    async generateResponse({ systemPrompt, conversationHistory, userInput }) {
        throw new Error(`${this.constructor.name} must implement generateResponse()`);
    }

    /**
     * Estimate token count for a string.
     * Providers should override with accurate counting.
     * Default: rough approximation (1 token ≈ 4 chars).
     *
     * @param {string} text
     * @returns {number}
     */
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }

    /**
     * Get the provider name for logging/debugging.
     * @returns {string}
     */
    get name() {
        return this.constructor.name;
    }
}
