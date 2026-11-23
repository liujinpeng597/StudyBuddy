FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/storage/package.json packages/storage/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @studybuddy/worker build
USER node
EXPOSE 3100
CMD ["pnpm", "--filter", "@studybuddy/worker", "start"]
