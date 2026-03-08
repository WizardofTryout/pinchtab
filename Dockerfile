# Dashboard Build stage
FROM oven/bun:1 AS dashboard-builder
WORKDIR /app
COPY dashboard/package.json ./
RUN bun install --frozen-lockfile
COPY dashboard/ ./
RUN bun run build

# Go Build stage
FROM golang:1.26-alpine AS builder
RUN apk add --no-cache git
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Copy the built dashboard assets into the correct internal package location
RUN mkdir -p internal/dashboard/dashboard
COPY --from=dashboard-builder /app/dist/ internal/dashboard/dashboard/
# Due to go:embed rules in internal/dashboard/dashboard.go: //go:embed dashboard/*
# And reading dashboard/dashboard.html, we must rename the output file
RUN mv internal/dashboard/dashboard/index.html internal/dashboard/dashboard/dashboard.html
RUN go build -ldflags="-s -w" -o pinchtab ./cmd/pinchtab

# Runtime stage
FROM alpine:latest

LABEL org.opencontainers.image.source="https://github.com/pinchtab/pinchtab"
LABEL org.opencontainers.image.description="High-performance browser automation bridge"

# Install Chromium and dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init

# Create non-root user and state directory
RUN adduser -D -g '' pinchtab && \
    mkdir -p /data && \
    chown pinchtab:pinchtab /data

# Copy binary and entrypoint from builder
COPY --from=builder /build/pinchtab /usr/local/bin/pinchtab
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

# Switch to non-root user
USER pinchtab
WORKDIR /data

# Environment variables
ENV BRIDGE_BIND=0.0.0.0 \
    BRIDGE_PORT=9867 \
    BRIDGE_HEADLESS=true \
    BRIDGE_STATE_DIR=/data \
    BRIDGE_PROFILE=/data/chrome-profile \
    CHROME_BINARY=/usr/bin/chromium-browser \
    CHROME_FLAGS="--no-sandbox --disable-gpu"

# Expose port
EXPOSE 9867

# Use dumb-init to properly handle signals
# entrypoint.sh cleans stale Chrome Singleton locks before starting
ENTRYPOINT ["/usr/bin/dumb-init", "--", "/usr/local/bin/entrypoint.sh"]

# Run pinchtab
CMD ["pinchtab"]