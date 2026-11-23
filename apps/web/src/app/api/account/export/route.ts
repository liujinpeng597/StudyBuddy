import { PassThrough } from "node:stream";
import archiver from "archiver";
import { query } from "@studybuddy/db";
import { getSource } from "@studybuddy/storage";
import { requireApiUser } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";

export async function GET() {
  try {
    const user = await requireApiUser();
    const [users, assets, nodes, relations, questions, attempts, problems] = await Promise.all([
      query("SELECT id, email, created_at FROM users WHERE id = $1", [user.id]),
      query(
        "SELECT id, file_name, type, mime_type, storage_path, study_date::text, created_at FROM source_assets WHERE user_id = $1",
        [user.id]
      ),
      query("SELECT * FROM knowledge_nodes WHERE user_id = $1", [user.id]),
      query("SELECT * FROM knowledge_relations WHERE user_id = $1", [user.id]),
      query("SELECT * FROM questions WHERE user_id = $1", [user.id]),
      query("SELECT * FROM attempts WHERE user_id = $1", [user.id]),
      query("SELECT * FROM leetcode_problems WHERE user_id = $1", [user.id])
    ]);
    const archive = archiver("zip", { zlib: { level: 9 } });
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.pipe(output);
    archive.append(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          user: users.rows[0],
          assets: assets.rows.map(({ storage_path: _storagePath, ...asset }) => asset),
          nodes: nodes.rows,
          relations: relations.rows,
          questions: questions.rows,
          attempts: attempts.rows,
          problems: problems.rows
        },
        null,
        2
      ),
      { name: "studybuddy.json" }
    );
    for (const asset of assets.rows) {
      const body = await getSource(asset.storage_path);
      archive.append(body, { name: `sources/${asset.id}-${asset.file_name}` });
    }
    await archive.finalize();
    const buffer = Buffer.concat(chunks);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="studybuddy-export-${new Date().toISOString().slice(0, 10)}.zip"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
