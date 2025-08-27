# Build stage
FROM node:20 AS builder

ARG APP
ARG PORT

ENV APP_NAME=$APP

WORKDIR /app

COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

COPY . .

# Build the application
RUN npm run build:$APP_NAME

# Production stage
FROM node:20-slim AS production

ARG APP
ARG PORT

ENV APP_NAME=$APP
ENV PORT=$PORT

WORKDIR /app

COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE $PORT

CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main.js"]

