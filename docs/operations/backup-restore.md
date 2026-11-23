# 备份与恢复

## PGlite 本地数据

1. 停止 Web、Worker 和 PGlite 进程。
2. 复制 `PGLITE_DATA_DIR` 到备份位置。
3. 复制 `LOCAL_STORAGE_PATH`，其中包含原始 Markdown 与截图。
4. 恢复时把两个目录放回原位置，再启动 `pnpm dev`。

## PostgreSQL

```powershell
pnpm exec tsx scripts/backup-db.ts
pnpm exec tsx scripts/restore-db.ts --confirm backups/studybuddy-<时间>.dump
```

`pg_dump` 必须可执行。恢复会覆盖数据库，只能在明确确认备份目标和环境后执行。

## 对象存储

启用存储版本控制，并按照服务商机制复制私有 Bucket。备份文件与加密主密钥必须分开保存。
