# ============================================================
# Multi-stage Dockerfile for WA Automation SaaS
# ============================================================

# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

# Install build tools for native modules
RUN apk add --no-cache python3 make g++

COPY package*.json ./
# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# --- Stage 2: Production Image ---
FROM node:20-alpine AS production
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy source code first
COPY --chown=appuser:nodejs . .

# Copy production node_modules from deps stage (this overwrites local node_modules if any)
COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules

# Remove unnecessary files
RUN rm -f .env.example Dockerfile docker-compose.yml README.md

# Switch to non-root user
USER appuser

# Expose both Backend (3000) and Frontend (3001) ports
EXPOSE 3000 3001

# Health check (Mainly for the API)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start the combined application (Server + Client)
CMD ["node", "run.js"]
