import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const file = process.argv[2];
  if (!process.argv.includes("--confirm")) {
    throw new Error("恢复会覆盖数据库。请添加 --confirm 并传入备份文件路径。");
  }
  if (!databaseUrl || !file) throw new Error("需要 DATABASE_URL 和备份文件路径");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "pg_restore",
      ["--clean", "--if-exists", "--no-owner", "--dbname", databaseUrl, path.resolve(file)],
      { stdio: "inherit" }
    );
    child.on("error", () => reject(new Error("需要 pg_restore")));
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`pg_restore exited ${code}`))
    );
  });
  console.log("database restored");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
