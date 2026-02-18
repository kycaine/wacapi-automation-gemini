import { UsageRepository } from './usageRepository.js';
import { UsageLimitError } from '../../utils/errors.js';

const repo = new UsageRepository();

export class UsageService {
    /**
     * Check if client has exceeded their monthly limits.
     * Throws UsageLimitError if exceeded.
     */
    async checkLimits(client) {
        const usage = await repo.getCurrentMonthUsage(client.id);

        if (usage.message_count >= client.monthly_message_limit) {
            throw new UsageLimitError(
                `Monthly message limit of ${client.monthly_message_limit} reached. Current: ${usage.message_count}`
            );
        }

        if (usage.token_count >= client.monthly_token_limit) {
            throw new UsageLimitError(
                `Monthly token limit of ${client.monthly_token_limit} reached. Current: ${usage.token_count}`
            );
        }

        return usage;
    }

    async trackUsage(clientId, messageCount = 1, tokenCount = 0) {
        return repo.incrementUsage(clientId, messageCount, tokenCount);
    }

    async getCurrentUsage(clientId) {
        return repo.getCurrentMonthUsage(clientId);
    }

    async getUsageHistory(clientId, months = 12) {
        return repo.getUsageHistory(clientId, months);
    }
}
