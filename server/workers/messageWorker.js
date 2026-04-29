import { Worker } from 'bullmq';
import { bullMQConnection } from '../config/redis.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Services
import { ClientsService } from '../modules/clients/clientsService.js';
import { ConversationsService } from '../modules/conversations/conversationsService.js';
import { MessagesService } from '../modules/messages/messagesService.js';
import { UsageService } from '../modules/usage/usageService.js';
import { AIService } from '../modules/ai/aiService.js';
import { AutomationEngine } from '../modules/automation/automationEngine.js';
import { WhatsAppService } from '../modules/whatsapp/whatsappService.js';
import { KnowledgeService } from '../modules/knowledge/knowledgeService.js';

const clientsService = new ClientsService();
const conversationsService = new ConversationsService();
const messagesService = new MessagesService();
const usageService = new UsageService();
const aiService = new AIService();
const automationEngine = new AutomationEngine();
const whatsappService = new WhatsAppService();
const knowledgeService = new KnowledgeService();

/**
 * Process a single incoming WhatsApp message.
 *
 * Flow:
 * 1. Idempotency check
 * 2. Load client (with decrypted access token)
 * 3. Check usage limits
 * 4. Load/create conversation
 * 5. Save user message
 * 6. If human active → stop (human is handling)
 * 7. Run automation engine
 * 8. If rule matched → execute action
 * 9. If no rule → call AI
 * 10. Save assistant message + update usage
 * 11. Send WhatsApp reply
 */
async function processMessage(job) {
    const { waMessageId, from, text, phoneNumberId } = job.data;
    logger.info({ phoneNumberId, jobId: job.id }, 'Worker received message job');

    const jobLogger = logger.child({ jobId: job.id, waMessageId, from });

    // --- Step 1: Idempotency check ---
    const alreadyProcessed = await messagesService.isMessageProcessed(waMessageId);
    if (alreadyProcessed) {
        jobLogger.info('Message already processed, skipping');
        return { skipped: true };
    }

    // --- Step 2: Load client ---
    let client;
    try {
        client = await clientsService.getClientByPhoneNumberId(phoneNumberId);
    } catch (error) {
        jobLogger.warn({ phoneNumberId, err: error.message, stack: error.stack }, 'Failed to load client for message');
        return { skipped: true, reason: 'unknown_client' };
    }

    const clientLogger = jobLogger.child({ clientId: client.id });

    // --- Step 3: Check usage limits ---
    try {
        await usageService.checkLimits(client);
    } catch (error) {
        clientLogger.warn({ err: error }, 'Usage limit exceeded, dropping message');
        await whatsappService.sendTextMessage(
            phoneNumberId,
            client.accessToken,
            from,
            '[!] Service temporarily unavailable. Please try again later.'
        );
        return { skipped: true, reason: 'usage_limit' };
    }

    // --- Step 4: Load/create conversation ---
    const conversation = await conversationsService.getOrCreateConversation(client.id, from);
    const convLogger = clientLogger.child({ conversationId: conversation.id, state: conversation.state });

    // --- Step 5: Save user message ---
    await messagesService.saveMessage({
        conversationId: conversation.id,
        clientId: client.id,
        role: 'user',
        content: text,
        waMessageId,
    });

    // Mark as processed (idempotency)
    await messagesService.markMessageProcessed(waMessageId, client.id);

    // --- Step 6: Human takeover check ---
    if (conversation.is_human_active) {
        convLogger.info('Human takeover active, skipping automated response');
        return { handled: 'human' };
    }

    // --- Step 7: Run automation engine ---
    const automationResult = await automationEngine.evaluate(conversation, text, client.id);

    let replyText = null;
    let tokensUsed = 0;

    if (automationResult.matched) {
        const { action } = automationResult;
        convLogger.info({ actionType: action.type, nextState: action.nextState }, 'Automation rule matched');

        // Transition state if needed
        if (action.nextState && action.nextState !== conversation.state) {
            await conversationsService.transitionState(conversation.id, client.id, action.nextState);
        }

        switch (action.type) {
            case 'reply':
                replyText = action.payload.message;
                break;

            case 'human_handoff':
                replyText = action.payload.message;
                await conversationsService.enableHumanTakeover(conversation.id, client.id);
                break;

            case 'ai_fallback':
                // Rule explicitly requests AI
                replyText = await callAI(client, conversation, text, convLogger);
                break;

            case 'state_change':
                // Just change state, no reply
                break;

            default:
                convLogger.warn({ actionType: action.type }, 'Unknown action type');
        }
    } else {
        // --- Step 9: No rule matched → AI fallback ---
        convLogger.info('No automation rule matched, calling AI');
        const aiResult = await callAI(client, conversation, text, convLogger);
        replyText = aiResult?.text;
        tokensUsed = aiResult?.tokensUsed || 0;
    }

    // --- Step 10: Save assistant message + update usage ---
    if (replyText) {
        await messagesService.saveMessage({
            conversationId: conversation.id,
            clientId: client.id,
            role: 'assistant',
            content: replyText,
            tokensUsed,
        });

        await usageService.trackUsage(client.id, 1, tokensUsed);

        // --- Step 11: Send WhatsApp reply ---
        await whatsappService.sendTextMessage(
            phoneNumberId,
            client.accessToken,
            from,
            replyText
        );

        convLogger.info({ tokensUsed }, 'Message processed and reply sent');
    }

    return { handled: automationResult.matched ? 'automation' : 'ai', tokensUsed };
}

/**
 * Helper: call AI with token-aware history.
 */
async function callAI(client, conversation, userInput, log) {
    try {
        // 1. Get Prompt-based knowledge
        const promptKnowledge = await knowledgeService.getPromptKnowledge(client.id);

        // 2. Perform RAG search for relevant knowledge
        const ragKnowledgeResults = await knowledgeService.searchRelevantKnowledge(client.id, userInput);
        const ragKnowledgeStr = ragKnowledgeResults.length > 0
            ? ragKnowledgeResults.map(k => `- ${k.content}`).join('\n')
            : '';

        // 3. Combine contexts
        let additionalContext = '';
        if (promptKnowledge) {
            additionalContext += `General Business Info:\n${promptKnowledge}\n\n`;
        }
        if (ragKnowledgeStr) {
            additionalContext += `Relevant specific info for this query:\n${ragKnowledgeStr}`;
        }

        const fullHistory = await messagesService.getRecentHistory(conversation.id, 100);
        const result = await aiService.generateResponse({
            systemPrompt: client.system_prompt,
            fullHistory,
            userInput,
            additionalContext: additionalContext || undefined
        });
        return result;
    } catch (error) {
        log.error({ err: error }, 'AI generation failed');
        return { text: 'I\'m sorry, I\'m having trouble responding right now. Please try again in a moment.', tokensUsed: 0 };
    }
}

/**
 * Create and start the BullMQ worker.
 */
export function createMessageWorker() {
    const worker = new Worker(
        env.QUEUE_NAME,
        processMessage,
        {
            connection: bullMQConnection,
            concurrency: env.QUEUE_CONCURRENCY,
            limiter: {
                max: 50,
                duration: 1000, // Max 50 jobs/second
            },
        }
    );

    worker.on('completed', (job, result) => {
        logger.info({ jobId: job.id, result }, 'Job completed');
    });

    worker.on('failed', (job, error) => {
        logger.error({ jobId: job?.id, err: error }, 'Job failed');
    });

    worker.on('error', (error) => {
        logger.error({ err: error }, 'Worker error');
    });

    logger.info({ queue: env.QUEUE_NAME, concurrency: env.QUEUE_CONCURRENCY }, 'Message worker started');
    return worker;
}
