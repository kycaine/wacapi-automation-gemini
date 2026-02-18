import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { LLMProvider } from './llmProvider.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ExternalServiceError } from '../../utils/errors.js';

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export class GeminiProvider extends LLMProvider {
    constructor() {
        super();
        this._client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
        this._modelName = env.GEMINI_MODEL;
    }

    /**
     * Generate a response using Gemini 2.5 Flash.
     *
     * @param {Object} params
     * @param {string} params.systemPrompt
     * @param {Array<{role: string, content: string, tokens_used: number}>} params.conversationHistory - DB message format
     * @param {string} params.userInput
     * @returns {Promise<{text: string, tokensUsed: number, promptTokens: number, completionTokens: number}>}
     */
    async generateResponse({ systemPrompt, conversationHistory, userInput }) {
        try {
            const model = this._client.getGenerativeModel({
                model: this._modelName,
                systemInstruction: systemPrompt,
                safetySettings: SAFETY_SETTINGS,
                generationConfig: {
                    maxOutputTokens: env.GEMINI_MAX_OUTPUT_TOKENS,
                    temperature: 0.7,
                    topP: 0.9,
                },
            });

            // Convert DB message format to Gemini's expected format
            const history = conversationHistory.map((msg) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            }));

            const chat = model.startChat({ history });
            const result = await chat.sendMessage(userInput);
            const response = result.response;

            if (!response) {
                throw new ExternalServiceError('Gemini', 'Empty response received');
            }

            const text = response.text();
            const usageMetadata = response.usageMetadata;

            const promptTokens = usageMetadata?.promptTokenCount || this.estimateTokens(userInput);
            const completionTokens = usageMetadata?.candidatesTokenCount || this.estimateTokens(text);
            const tokensUsed = usageMetadata?.totalTokenCount || promptTokens + completionTokens;

            logger.debug({
                provider: this.name,
                model: this._modelName,
                promptTokens,
                completionTokens,
                tokensUsed,
            }, 'Gemini response generated');

            return { text, tokensUsed, promptTokens, completionTokens };
        } catch (error) {
            if (error instanceof ExternalServiceError) throw error;

            logger.error({ err: error, provider: this.name }, 'Gemini API error');

            // Handle specific Gemini error types
            if (error.message?.includes('SAFETY')) {
                throw new ExternalServiceError('Gemini', 'Response blocked by safety filters');
            }
            if (error.message?.includes('QUOTA') || error.status === 429) {
                throw new ExternalServiceError('Gemini', 'API quota exceeded');
            }

            throw new ExternalServiceError('Gemini', error.message || 'Unknown error');
        }
    }

    /**
     * More accurate token estimation for Gemini (roughly 1 token per 4 chars for English).
     */
    estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 4);
    }
}
