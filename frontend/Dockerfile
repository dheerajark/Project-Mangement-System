# Stage 1: Build the Next.js application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
# Run Next.js build
RUN npm run build

# Stage 2: Production environment
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

COPY package*.json ./
# Install production dependencies only
RUN npm ci --only=production

# Copy built bundles and static files
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/public ./public

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Run next start on port 3001 to match Nginx proxy upstream mapping
CMD ["npx", "next", "start", "-p", "3001"]
