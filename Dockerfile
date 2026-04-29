# ============================================================
# Multi-stage Dockerfile for WA Automation SaaS (HF Optimized)
# ============================================================

# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

# Install build tools untuk native modules (penting untuk beberapa library crypto/ML)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
# Install production dependencies saja
RUN npm ci --only=production && npm cache clean --force

# --- Stage 2: Production Image ---
FROM node:20-alpine AS production
WORKDIR /app

# Set environment ke production
ENV NODE_ENV=production

# --- PENYETARAAN PORT ---
# Di lokal akan pakai 3000, di HF kita akan timpa lewat Settings menjadi 7860
ENV PORT=3000

# Create non-root user untuk keamanan (Best Practice)
RUN addgroup -g 1001 -S nodejs && \
  adduser -S appuser -u 1001 -G nodejs

# Copy source code
COPY --chown=appuser:nodejs . .

# Copy node_modules dari stage deps
COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules

# Bersihkan file sampah agar image ramping
RUN rm -f .env.example Dockerfile docker-compose.yml README.md

# Gunakan user non-root
USER appuser

# Expose port (HF akan otomatis mendeteksi port 7860 jika diset di Env)
EXPOSE 3000
EXPOSE 7860

# Healthcheck disesuaikan dengan variabel PORT
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start aplikasi
CMD ["node", "run.js"]