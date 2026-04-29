# ============================================================
# Dockerfile for Hugging Face Space (Full Stack - Port 7860)
# ============================================================

# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# --- Stage 2: Production Image ---
FROM node:20-alpine AS production
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Hugging Face Spaces use port 7860 by default
ENV PORT=7860

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy source code
COPY --chown=appuser:nodejs . .

# Copy production node_modules from deps stage
COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules

# Clean up build files
RUN rm -f .env.example Dockerfile* docker-compose.yml README.md run.js

# Switch to non-root user
USER appuser

# Expose the Hugging Face port
EXPOSE 7860

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:7860/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start the application (Backend + Frontend combined)
CMD ["node", "server/server.js"]