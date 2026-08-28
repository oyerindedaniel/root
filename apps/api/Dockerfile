FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable

WORKDIR /app

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/accounts/package.json ./apps/accounts/
COPY apps/root/package.json ./apps/root/
COPY apps/shop/package.json ./apps/shop/
COPY apps/support/package.json ./apps/support/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/auth/package.json ./packages/auth/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY tooling/typescript-config/package.json ./tooling/typescript-config/
COPY tooling/eslint-config/package.json ./tooling/eslint-config/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter "@repo/api..." --ignore-scripts \
  && pnpm rebuild esbuild

COPY apps/api ./apps/api
COPY packages/auth ./packages/auth
COPY packages/contracts ./packages/contracts
COPY packages/db ./packages/db
COPY tooling/typescript-config ./tooling/typescript-config
COPY tooling/eslint-config ./tooling/eslint-config

RUN pnpm --filter @repo/contracts build \
  && pnpm --filter @repo/api check-types

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=4000
ENV LISTEN_HOST=0.0.0.0

WORKDIR /app

COPY --from=build /app /app
COPY apps/api/docker-entrypoint.sh /usr/local/bin/root-api-entrypoint.sh
RUN chmod +x /usr/local/bin/root-api-entrypoint.sh \
  && groupadd --system --gid 1001 rootapi \
  && useradd --system --uid 1001 --gid rootapi --home-dir /home/rootapi --create-home rootapi \
  && chown -R rootapi:rootapi /app

USER rootapi

EXPOSE 4000

ENTRYPOINT ["/usr/local/bin/root-api-entrypoint.sh"]
CMD ["pnpm", "--filter", "@repo/api", "start"]

FROM build AS development

ENV NODE_ENV=development
ENV PORT=4000
ENV LISTEN_HOST=0.0.0.0

WORKDIR /app

COPY apps/api/docker-entrypoint.sh /usr/local/bin/root-api-entrypoint.sh
COPY apps/api/docker-watch.sh /usr/local/bin/root-api-watch.sh
RUN chmod +x /usr/local/bin/root-api-entrypoint.sh \
  /usr/local/bin/root-api-watch.sh \
  && groupadd --system --gid 1001 rootapi \
  && useradd --system --uid 1001 --gid rootapi --home-dir /home/rootapi --create-home rootapi \
  && chown -R rootapi:rootapi /app

USER rootapi

EXPOSE 4000

ENTRYPOINT ["/usr/local/bin/root-api-entrypoint.sh"]
CMD ["/usr/local/bin/root-api-watch.sh"]
