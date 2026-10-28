FROM node:24.18.0-bookworm-slim AS dependencies
WORKDIR /app
# Refuse incomplete source before dependency installation or application build.
COPY .github/bootstrap-policy.json ./.github/bootstrap-policy.json
COPY scripts/release-files.mjs ./scripts/release-files.mjs
RUN node --input-type=module -e \
    "import { requireApplicationReady } from './scripts/release-files.mjs'; \
    await requireApplicationReady(process.cwd());"
COPY package.json package-lock.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 NEXT_TELEMETRY_DISABLED=1
RUN npm ci --ignore-scripts

FROM dependencies AS build
COPY src ./src
COPY public ./public
COPY next-env.d.ts next.config.ts tsconfig.json postcss.config.mjs performance-budget.json ./
# The build command owns readiness, environment and bundle checks through these helpers.
COPY scripts ./scripts
ENV NODE_ENV=production API_BASE_URL=http://127.0.0.1:3100 HOSTNAME=127.0.0.1 PORT=3010 \
    WEBSITE_URL=http://127.0.0.1:3010 WEBSITE_INDEXING_ENABLED=false \
    WEBSITE_CSP_MODE=enforce KERNEL_SYNTHETIC_ENV=1
RUN npm run build

FROM node:24.18.0-bookworm-slim AS website
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3001
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --chown=node:node .github/bootstrap-policy.json ./.github/bootstrap-policy.json
COPY --chown=node:node scripts/healthcheck.mjs scripts/validate-deployment-env.mjs scripts/release-files.mjs ./scripts/
COPY deploy/docker/website-entrypoint.sh ./deploy/docker/website-entrypoint.sh
USER node
EXPOSE 3001
ENTRYPOINT ["sh", "deploy/docker/website-entrypoint.sh"]
CMD ["node", "server.js"]

FROM nginx:1.30.6-trixie AS gateway
COPY deploy/docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/docker/15-validate-configuration.sh /docker-entrypoint.d/15-validate-configuration.sh
RUN test "$(id -u nginx)" = 101 \
    && test "$(id -g nginx)" = 101 \
    && sed -i \
        -e '/^user[[:space:]]/d' \
        -e 's@^pid[[:space:]].*;@pid /var/cache/nginx/nginx.pid;@' \
        /etc/nginx/nginx.conf \
    && grep -q '^pid /var/cache/nginx/nginx.pid;' /etc/nginx/nginx.conf \
    && mkdir -p /var/cache/nginx /etc/nginx/conf.d /etc/kernel/tls \
    && chown -R nginx:nginx /var/cache/nginx /etc/nginx/conf.d \
    && chown root:nginx /etc/kernel/tls \
    && chmod 750 /var/cache/nginx /etc/nginx/conf.d /etc/kernel/tls \
    && chmod 755 /docker-entrypoint.d/15-validate-configuration.sh
ENV NGINX_ENVSUBST_FILTER="^(WEBSITE_HOST|RELEASE_ID|HTTPS_PORT)$"
USER nginx
EXPOSE 8080 8443
