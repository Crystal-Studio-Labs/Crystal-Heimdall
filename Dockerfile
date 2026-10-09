# Multi-stage Production Build for Crystal Heimdall
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies for build
COPY package*.json ./
RUN npm ci

# Copy source tree
COPY . .

# Compile Vite client (dist-client) and TypeScript server (dist-server)
RUN npm run build

# Production Minimal Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3030

# Copy package manifests and install runtime dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled assets from builder
COPY --from=builder /app/dist-client ./dist-client
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/client/public ./client/public

# Ensure persistent data directory exists
RUN mkdir -p /app/data

EXPOSE 3030

VOLUME ["/app/data"]

CMD ["node", "dist-server/index.js"]
