# ============================================================
# Stage 1: Builder — TypeScript build করার জন্য
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# আগে package files কপি করো (Docker cache এর জন্য)
# code না বদলালে npm ci আবার run হবে না — build faster হবে
COPY package*.json ./

# সব dependency install (dev সহ — build এর জন্য লাগবে)
RUN npm ci

# Source code কপি করো
COPY . .

# TypeScript → JavaScript build
RUN npm run build

# ============================================================
# Stage 2: Production — ছোট, fast, secure image
# ============================================================
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Production environment
ENV NODE_ENV=production

COPY package*.json ./

# শুধু production dependency install করো (dev packages বাদ)
# এতে image size অনেক ছোট হয়
RUN npm ci --only=production && npm cache clean --force

# Builder stage থেকে compiled JavaScript কপি করো
COPY --from=builder /usr/src/app/dist ./dist

# Security: root user এর বদলে non-root user
# Container hack হলেও server এর root access পাবে না
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001
USER nestjs

# App কোন port এ চলবে
EXPOSE 5000

# Container চালু হলে app start হবে
CMD ["node", "dist/src/main"]