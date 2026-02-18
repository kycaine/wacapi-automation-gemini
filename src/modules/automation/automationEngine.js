import { query } from '../../database/index.js';
import { DEFAULT_RULES } from './automationRules.js';
import { logger } from '../../utils/logger.js';

export class AutomationEngine {
    /**
     * Find the first matching rule for a given conversation state and message.
     *
     * @param {Object} conversation - Current conversation record
     * @param {string} messageText - Incoming user message text
     * @param {string} clientId - Client ID to load client-specific rules
     * @returns {Promise<{matched: boolean, rule?: Object, action?: Object}>}
     */
    async evaluate(conversation, messageText, clientId) {
        const rules = await this._loadRules(clientId, conversation.state);
        const normalizedText = messageText.toLowerCase().trim();

        for (const rule of rules) {
            if (this._matches(rule, conversation.state, normalizedText)) {
                logger.debug({ ruleId: rule.id, ruleName: rule.name, state: conversation.state }, 'Automation rule matched');

                return {
                    matched: true,
                    rule,
                    action: {
                        type: rule.action_type,
                        payload: rule.action_payload,
                        nextState: rule.next_state,
                    },
                };
            }
        }

        return { matched: false };
    }

    /**
     * Load client-specific rules from DB, falling back to defaults.
     * Rules are sorted by priority descending.
     */
    async _loadRules(clientId, currentState) {
        try {
            const result = await query(
                `SELECT * FROM automation_rules
         WHERE client_id = $1
           AND is_active = TRUE
           AND (trigger_state = 'any' OR trigger_state = $2)
         ORDER BY priority DESC`,
                [clientId, currentState]
            );

            if (result.rowCount > 0) {
                return result.rows;
            }
        } catch (error) {
            logger.warn({ err: error, clientId }, 'Failed to load DB rules, using defaults');
        }

        // Fall back to default rules filtered by state
        return DEFAULT_RULES
            .filter((r) => r.trigger_state === 'any' || r.trigger_state === currentState)
            .sort((a, b) => b.priority - a.priority);
    }

    /**
     * Check if a rule matches the current state and message.
     */
    _matches(rule, currentState, normalizedText) {
        // State check
        if (rule.trigger_state !== 'any' && rule.trigger_state !== currentState) {
            return false;
        }

        switch (rule.trigger_type) {
            case 'keyword': {
                const keywords = rule.trigger_value.split('|').map((k) => k.trim().toLowerCase());
                return keywords.some((kw) => normalizedText.includes(kw));
            }

            case 'regex': {
                try {
                    const regex = new RegExp(rule.trigger_value, 'i');
                    return regex.test(normalizedText);
                } catch {
                    logger.warn({ ruleId: rule.id, pattern: rule.trigger_value }, 'Invalid regex in rule');
                    return false;
                }
            }

            case 'state_enter':
                // Fires when conversation enters this state (handled externally)
                return false;

            case 'always':
                return true;

            default:
                return false;
        }
    }
}
