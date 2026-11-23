# 部署说明

## 本地开发

`pnpm dev` 同时启动 PGlite、Next.js 和 Worker。PGlite 监听 `5432`，Web 监听 `3000`，Worker 健康检查监听 `3100`。

## 生产部署

1. 准备 PostgreSQL 16，启用 `pg_trgm`、`pgcrypto`，并按需要启用 `pgvector`。
2. 配置 S3 兼容私有对象存储，并设置 `STORAGE_DRIVER=s3`。
3. 配置 `SECRET_BOX_KEYS_JSON` 和 `SECRET_BOX_ACTIVE_KEY_ID`。
4. 应用迁移：`pnpm db:migrate`。
5. 部署 Worker：`pnpm --filter @studybuddy/worker start`。
6. 部署 Web：`pnpm --filter @studybuddy/web build`，然后 `pnpm --filter @studybuddy/web start`。
7. 运行 `pnpm smoke`。

生产必须使用 HTTPS、私密对象存储和独立数据库凭据。不要使用 `.env.example` 中的开发值。
