# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: install deps, generate the ANTLR parser, build + stage the site
# ---------------------------------------------------------------------------
# The build output is static files, so it always runs on the native build
# platform; only the nginx stage is per-architecture.
FROM --platform=$BUILDPLATFORM node:25.9.0-alpine AS build
WORKDIR /app

# Base path the app is served from inside the container ("/" by default).
ARG VITE_BASE_PATH=/
# Optional override of the AI pane endpoint.
ARG VITE_AI_API_URL
ENV VITE_BASE_PATH=${VITE_BASE_PATH} \
    VITE_AI_API_URL=${VITE_AI_API_URL}

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build-g4 && npm run build:site

# ---------------------------------------------------------------------------
# Runtime stage: static files served by nginx
# ---------------------------------------------------------------------------
FROM nginx:1.30-alpine AS runtime

ARG VITE_BASE_PATH=/
# Normalised to "/" or "/some/path/"; consumed by the nginx config template.
ENV BASE_PATH=${VITE_BASE_PATH}

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/normalize-base-path.sh /docker-entrypoint.d/05-normalize-base-path.envsh
COPY --from=build /app/build/site /usr/share/nginx/html${VITE_BASE_PATH}

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
