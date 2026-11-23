import "dotenv/config";
import { closePool, query } from "@studybuddy/db";
import { regroupKnowledge } from "../apps/web/src/lib/server/knowledge-regroup";

async function main() {
  const users = await query<{ id: string }>("SELECT id FROM users ORDER BY created_at LIMIT 1");
  const userId = users.rows[0]?.id;
  if (!userId) throw new Error("No user found");
  const result = await regroupKnowledge(userId);
  console.log(`regrouped ${result.changed} knowledge point(s)`);
  await closePool();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closePool();
  process.exitCode = 1;
});
