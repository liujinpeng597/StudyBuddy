import "dotenv/config";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const directory = path.resolve(process.env.BACKUP_DIR ?? "./backups");
  await fs.mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(directory, `studybuddy-${stamp}.dump`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pg_dump", ["--format=custom", "--file", target, databaseUrl], {
      stdio: "inherit"
    });
    child.on("error", () =>
      reject(new Error("需要 pg_dump。内置 PGlite 请在停止服务后复制 PGLITE_DATA_DIR 目录。"))
    );
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump exited ${code}`))));
  });
  console.log(`database backup: ${target}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
