import "dotenv/config";
import { closePool, query } from "@studybuddy/db";

const result = await query(
  `UPDATE import_jobs
      SET status = 'queued', progress = 5, lock_token = NULL, locked_at = NULL,
          lease_expires_at = NULL, error_code = NULL, error_message = NULL,
          retry_count = 0, updated_at = now()
    WHERE status NOT IN ('completed', 'draft', 'undone')
    RETURNING id`
);
console.log(`requeued ${result.rowCount} job(s)`);
await closePool();
