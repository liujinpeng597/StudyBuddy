import { NextResponse } from "next/server";
import { query } from "@studybuddy/db";
import { getSource } from "@studybuddy/storage";
import { requireApiUser } from "@/lib/server/auth";
import { errorResponse, jsonError } from "@/lib/server/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const result = await query<{ storage_path: string; mime_type: string }>(
      "SELECT storage_path, mime_type FROM source_assets WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
    const asset = result.rows[0];
    if (!asset) return jsonError("来源不存在", 404);
    const body = await getSource(asset.storage_path);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": asset.mime_type,
        "Cache-Control": "private, max-age=60"
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
