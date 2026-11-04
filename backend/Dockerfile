# ==========================================
# Stage 1: Build the application
# ==========================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install tools required for native Node.js modules
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 \
       make \
       g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy TypeScript configuration and source
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev


# ==========================================
# Stage 2: Production runtime
# ==========================================
FROM node:22-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV DATABASE_PATH=/app/data/database.sqlite

# Copy production dependencies from builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Copy compiled JavaScript
COPY --from=builder --chown=node:node /app/dist ./dist

# Create database directory
RUN mkdir -p /app/data \
    && chown -R node:node /app

# Run as non-root user
USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]