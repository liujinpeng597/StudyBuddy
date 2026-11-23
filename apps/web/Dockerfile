FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/test-fixtures/package.json packages/test-fixtures/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @studybuddy/web build
USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "@studybuddy/web", "start"]
