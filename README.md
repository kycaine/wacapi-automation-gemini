# WhatsApp Cloud API Automation with GEMINI

A production-ready, multi-tenant WhatsApp Automation SaaS platform built with **Node.js (Fastify)**, **PostgreSQL**, **Redis (BullMQ)**, and **Google Gemini 2.5 Flash**.

---

## Features

- [ORG] **Multi-tenant** — Each client has isolated data, API keys, and WhatsApp credentials
- [AI] **Gemini AI** — Token-aware conversation history, not just last N messages
- [AUTO] **State Machine Automation** — Keyword/regex rules with state transitions before AI fallback
- [HUMAN] **Human Takeover** — Pause AI per conversation; resume on demand
- [STAT] **Usage Tracking** — Monthly message and token counts with configurable limits
- [SEC] **Security** — AES-256-GCM token encryption, HMAC webhook verification, API key hashing
- [QUEUE] **Async Queue** — BullMQ workers for scalable, reliable message processing
- [DOCKER] **Docker Ready** — Full Docker Compose stack

---

## Architecture

```
server/
├── config/          # env.js (Zod), database.js, redis.js
├── database/        # schema.sql, migrate.js, index.js
├── modules/
│   ├── auth/        # API key middleware
│   ├── clients/     # Tenant management
│   ├── conversations/
│   ├── messages/
│   ├── automation/  # State machine engine + rules
│   ├── ai/          # LLM interface + Gemini provider
│   ├── usage/       # Monthly tracking + limits
│   └── whatsapp/    # Webhook + Graph API sender
├── services/        # encryptionService.js
├── utils/           # logger, errors, sanitize
├── workers/         # BullMQ message processor
├── app.js           # Fastify app factory
└── server.js        # Entry point
```

**Message Processing Flow:**
```
Meta Webhook → Signature Verify → Redis Queue → Worker:
  → Load Client → Check Limits → Load/Create Conversation
  → Save User Message → Human Active? Stop
  → Automation Engine → Rule Matched? Execute
  → No Rule? → Gemini AI → Save Reply → Send via Graph API
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Google Gemini API key
- Meta WhatsApp Business App

### 1. Clone & Configure

```bash
git clone <repo>
cd wacapi-automation-gemini
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | From [Google AI Studio](https://aistudio.google.com/) |
| `META_APP_SECRET` | From Meta Developer Console → App Settings |
| `WEBHOOK_VERIFY_TOKEN` | Any string you define in Meta webhook config |
| `ENCRYPTION_KEY` | 64-char hex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_SECRET` | Min 32 chars: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ADMIN_TOKEN` | Secret token for admin API access |
| `DB_PASSWORD` | PostgreSQL password |

### 2. Start with Docker Compose

```bash
docker-compose up --build
```

This starts PostgreSQL, Redis, and the app. Migrations run automatically on startup.

### 3. Register a Client

```bash
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: your_admin_token" \
  -d '{
    "name": "My Business",
    "whatsapp_business_id": "YOUR_WA_BUSINESS_ID",
    "whatsapp_phone_number_id": "YOUR_PHONE_NUMBER_ID",
    "access_token": "YOUR_WA_ACCESS_TOKEN",
    "system_prompt": "You are a helpful customer service agent for My Business."
  }'
```

**Save the `apiKey` from the response** — it is shown only once.

### 4. Configure Meta Webhook

In Meta Developer Console:
- **Webhook URL**: `https://your-domain.com/webhook`
- **Verify Token**: value of `WEBHOOK_VERIFY_TOKEN` in `.env`
- **Subscribe to**: `messages`

### 5. Test Locally

```bash
# Simulate an incoming WhatsApp message
META_APP_SECRET=your_secret bash scripts/test-webhook.sh 123456789 628123456789 "hello"
```

---

## API Reference

### Admin Endpoints (requires `X-Admin-Token`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/clients` | Register a new tenant |
| `GET` | `/api/admin/clients` | List all clients |
| `GET` | `/api/admin/clients/:id` | Get client details |
| `PUT` | `/api/admin/clients/:id` | Update client |
| `DELETE` | `/api/admin/clients/:id` | Delete client |

### Tenant Endpoints (requires `X-API-Key`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/conversations` | List conversations |
| `GET` | `/api/conversations/:id` | Get conversation |
| `POST` | `/api/conversations/:id/human-takeover` | Enable human takeover |
| `DELETE` | `/api/conversations/:id/human-takeover` | Disable human takeover |
| `GET` | `/api/conversations/:id/messages` | Get message history |
| `GET` | `/api/usage` | Get usage stats |

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/webhook` | Meta verification challenge |
| `POST` | `/webhook` | Receive WhatsApp messages |

---

## Automation Rules

Rules are stored in the `automation_rules` table per client. Each rule defines:

```json
{
  "trigger_state": "initial",
  "trigger_type": "keyword",
  "trigger_value": "hello|hi|hey",
  "action_type": "reply",
  "action_payload": { "message": "Hello! How can I help?" },
  "next_state": "active",
  "priority": 100
}
```

**Action types:** `reply` | `ai_fallback` | `human_handoff` | `state_change`
**Trigger types:** `keyword` | `regex` | `always`

If no rule matches, the message is sent to Gemini AI automatically.

---

## LLM Abstraction

To swap Gemini for another provider:

1. Create `server/modules/ai/openaiProvider.js` extending `LLMProvider`
2. Implement `generateResponse({ systemPrompt, conversationHistory, userInput })`
3. Update the import in `server/modules/ai/aiService.js`

---

## Production Notes

- **Scaling**: Run multiple app instances behind a load balancer. Workers are stateless and can scale independently.
- **Token Encryption**: `ENCRYPTION_KEY` must be backed up securely. Losing it means losing access to all stored WhatsApp tokens.
- **Webhook**: Must be HTTPS in production. Use nginx or a reverse proxy.
- **Redis**: Use Redis Cluster or Redis Sentinel for HA in production.
- **DB**: Use connection pooling (PgBouncer) for high-traffic deployments.
- **Logs**: Structured JSON logs are ready for ingestion by Datadog, Loki, or CloudWatch.
- **Idempotency**: Duplicate webhook deliveries from Meta are safely deduplicated via `processed_messages` table.

---

## Environment Variables Reference

See [`.env.example`](.env.example) for the full list with descriptions.
