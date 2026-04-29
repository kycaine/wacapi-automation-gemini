-- ============================================================
-- WA Automation SaaS - PostgreSQL Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- CLIENTS (Tenants)
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                      VARCHAR(255) NOT NULL,
  whatsapp_business_id      VARCHAR(255) NOT NULL UNIQUE,
  whatsapp_phone_number_id  VARCHAR(255) NOT NULL UNIQUE,
  access_token_encrypted    TEXT NOT NULL,
  system_prompt             TEXT NOT NULL DEFAULT 'You are a helpful WhatsApp assistant.',
  api_key_hash              VARCHAR(255) UNIQUE,
  monthly_message_limit     INTEGER NOT NULL DEFAULT 10000,
  monthly_token_limit       INTEGER NOT NULL DEFAULT 5000000,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_whatsapp_business_id ON clients(whatsapp_business_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone_number_id ON clients(whatsapp_phone_number_id);
CREATE INDEX IF NOT EXISTS idx_clients_api_key_hash ON clients(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  wa_number        VARCHAR(20) NOT NULL,
  state            VARCHAR(100) NOT NULL DEFAULT 'initial',
  is_human_active  BOOLEAN NOT NULL DEFAULT FALSE,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite unique: one conversation per (client, phone number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_client_wa_number
  ON conversations(client_id, wa_number);

CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_wa_number ON conversations(wa_number);
CREATE INDEX IF NOT EXISTS idx_conversations_state ON conversations(state);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role             VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT NOT NULL,
  tokens_used      INTEGER NOT NULL DEFAULT 0,
  wa_message_id    VARCHAR(255),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_wa_message_id ON messages(wa_message_id) WHERE wa_message_id IS NOT NULL;

-- Composite index for history loading (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON messages(conversation_id, created_at DESC);

-- ============================================================
-- USAGE STATS (Monthly aggregates per client)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_stats (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  month          DATE NOT NULL,  -- First day of the month: '2025-01-01'
  message_count  INTEGER NOT NULL DEFAULT 0,
  token_count    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT usage_stats_client_month_unique UNIQUE (client_id, month)
);

CREATE INDEX IF NOT EXISTS idx_usage_stats_client_id ON usage_stats(client_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_month ON usage_stats(month DESC);
CREATE INDEX IF NOT EXISTS idx_usage_stats_client_month
  ON usage_stats(client_id, month DESC);

-- ============================================================
-- AUTOMATION RULES (State machine rules per client)
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_rules (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  trigger_state  VARCHAR(100) NOT NULL DEFAULT 'any',
  trigger_type   VARCHAR(50) NOT NULL DEFAULT 'keyword',
  trigger_value  TEXT NOT NULL,
  action_type    VARCHAR(50) NOT NULL DEFAULT 'reply',
  action_payload JSONB NOT NULL DEFAULT '{}',
  next_state     VARCHAR(100),
  priority       INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_client_id ON automation_rules(client_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_client_state
  ON automation_rules(client_id, trigger_state, is_active, priority DESC);

-- ============================================================
-- PROCESSED MESSAGES (Idempotency tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS processed_messages (
  wa_message_id  VARCHAR(255) PRIMARY KEY,
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_messages_client_id ON processed_messages(client_id);
-- Auto-cleanup: processed_at older than 7 days can be purged
CREATE INDEX IF NOT EXISTS idx_processed_messages_processed_at ON processed_messages(processed_at);

-- ============================================================
-- KNOWLEDGE (RAG & Prompt context)
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL,
  content        TEXT NOT NULL,
  type_knowledge VARCHAR(50) NOT NULL CHECK (type_knowledge IN ('rag', 'prompt')),
  embedding      VECTOR(768),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_client_id ON knowledge(client_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type_knowledge);
CREATE INDEX IF NOT EXISTS idx_knowledge_client_type ON knowledge(client_id, type_knowledge);

-- ============================================================
-- TRIGGERS: auto-update updated_at columns
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clients_updated_at') THEN
    CREATE TRIGGER trg_clients_updated_at
      BEFORE UPDATE ON clients
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conversations_updated_at') THEN
    CREATE TRIGGER trg_conversations_updated_at
      BEFORE UPDATE ON conversations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_usage_stats_updated_at') THEN
    CREATE TRIGGER trg_usage_stats_updated_at
      BEFORE UPDATE ON usage_stats
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_automation_rules_updated_at') THEN
    CREATE TRIGGER trg_automation_rules_updated_at
      BEFORE UPDATE ON automation_rules
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_knowledge_updated_at') THEN
    CREATE TRIGGER trg_knowledge_updated_at
      BEFORE UPDATE ON knowledge
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
