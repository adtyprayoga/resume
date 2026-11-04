FROM oven/bun:1.4.4 AS bun

FROM node:22.23.4-bookworm-slim AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# "1" shows the PDF import option; it needs the pdf-import backend behind the
# same origin (compose.yaml). The default static-only build leaves it off.
ARG VITE_PDF_IMPORT=0
RUN VITE_PDF_IMPORT=$VITE_PDF_IMPORT bun run build

FROM nginx:1.30.6-alpine AS runtime
# nginx.pdf-import.conf adds the /api/pdf-import proxy for the combined deployment.
ARG NGINX_CONF=nginx.conf
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
