/**
 * Automation Rules Definition.
 *
 * Rules are evaluated in priority order (highest first).
 * Each rule defines:
 *   - trigger_state: conversation state this rule applies to ('any' = all states)
 *   - trigger_type: 'keyword' | 'regex' | 'state_enter' | 'always'
 *   - trigger_value: the keyword/pattern to match
 *   - action_type: 'reply' | 'ai_fallback' | 'human_handoff' | 'state_change'
 *   - action_payload: { message?, nextState? }
 *   - next_state: state to transition to after this rule fires
 *
 * In production, these rules are loaded from the `automation_rules` DB table
 * per client. This file provides the default fallback rules.
 */

export const DEFAULT_RULES = [
    {
        id: 'default-greeting',
        name: 'Greeting Handler',
        trigger_state: 'initial',
        trigger_type: 'keyword',
        trigger_value: 'hello|hi|halo|hey|start',
        action_type: 'reply',
        action_payload: {
            message: 'Hello! [HI] Welcome. How can I help you today?\n\nType *menu* to see options or just ask me anything.',
        },
        next_state: 'active',
        priority: 100,
    },
    {
        id: 'default-menu',
        name: 'Menu Request',
        trigger_state: 'any',
        trigger_type: 'keyword',
        trigger_value: 'menu|help|options',
        action_type: 'reply',
        action_payload: {
            message: '[MENU] *Main Menu*\n\n1. Type *info* for information\n2. Type *support* to talk to support\n3. Type *human* to speak with a human agent\n\nOr just ask me anything!',
        },
        next_state: null, // Keep current state
        priority: 90,
    },
    {
        id: 'default-human-request',
        name: 'Human Agent Request',
        trigger_state: 'any',
        trigger_type: 'keyword',
        trigger_value: 'human|agent|operator|person|staff',
        action_type: 'human_handoff',
        action_payload: {
            message: '[HUMAN] Connecting you to a human agent. Please wait...\n\nAI responses are now paused.',
        },
        next_state: 'human_handoff',
        priority: 95,
    },
    {
        id: 'default-goodbye',
        name: 'Goodbye Handler',
        trigger_state: 'any',
        trigger_type: 'keyword',
        trigger_value: 'bye|goodbye|quit|exit|stop',
        action_type: 'reply',
        action_payload: {
            message: 'Thank you for reaching out! Have a great day! [HI]\n\nFeel free to message us anytime.',
        },
        next_state: 'ended',
        priority: 85,
    },
];
