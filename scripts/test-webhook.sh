#!/usr/bin/env bash
# ============================================================
# Test WhatsApp Webhook Simulation
# Usage: bash scripts/test-webhook.sh [phone_number_id] [from] [message]
# ============================================================

set -e

PHONE_NUMBER_ID="${1:-123456789}"
FROM="${2:-628123456789}"
MESSAGE="${3:-hello}"
WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:3000/webhook}"
META_APP_SECRET="${META_APP_SECRET:-your_meta_app_secret_here}"

# Build the payload
PAYLOAD=$(cat <<EOF
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550000000",
          "phone_number_id": "${PHONE_NUMBER_ID}"
        },
        "contacts": [{
          "profile": { "name": "Test User" },
          "wa_id": "${FROM}"
        }],
        "messages": [{
          "from": "${FROM}",
          "id": "wamid.test_$(date +%s)_$(shuf -i 1000-9999 -n 1)",
          "timestamp": "$(date +%s)",
          "text": { "body": "${MESSAGE}" },
          "type": "text"
        }]
      },
      "field": "messages"
    }]
  }]
}
EOF
)

# Compute HMAC-SHA256 signature
SIGNATURE="sha256=$(echo -n "${PAYLOAD}" | openssl dgst -sha256 -hmac "${META_APP_SECRET}" | awk '{print $2}')"

echo "📤 Sending test webhook to ${WEBHOOK_URL}"
echo "   From: ${FROM}"
echo "   Message: ${MESSAGE}"
echo "   Phone Number ID: ${PHONE_NUMBER_ID}"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: ${SIGNATURE}" \
  -d "${PAYLOAD}")

HTTP_CODE=$(echo "${RESPONSE}" | tail -n1)
BODY=$(echo "${RESPONSE}" | head -n-1)

echo "📥 Response (${HTTP_CODE}):"
echo "${BODY}" | python3 -m json.tool 2>/dev/null || echo "${BODY}"

if [ "${HTTP_CODE}" = "200" ]; then
  echo ""
  echo "✅ Webhook accepted successfully"
else
  echo ""
  echo "❌ Webhook failed with status ${HTTP_CODE}"
  exit 1
fi
