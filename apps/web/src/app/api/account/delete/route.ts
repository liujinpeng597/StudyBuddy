import { z } from "zod";
import { NextResponse } from "next/server";
import { query, withTransaction } from "@studybuddy/db";
import { verifyPassword } from "@studybuddy/core";
import { deleteSource } from "@studybuddy/storage";
import { clearSessionCookie, requireApiUser } from "@/lib/server/auth";
import { assertSameOrigin, errorResponse, jsonError } from "@/lib/server/http";

const deleteSchema = z.object({
  password: z.string().min(1).max(256),
  confirmation: z.literal("删除我的全部数据")
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("确认文字不正确");
    const userRow = await query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [user.id]
    );
    if (!userRow.rows[0] || !(await verifyPassword(userRow.rows[0].password_hash, parsed.data.password))) {
      return jsonError("密码错误", 401);
    }
    const assets = await query<{ storage_path: string }>(
      "SELECT storage_path FROM source_assets WHERE user_id = $1",
      [user.id]
    );
    for (const asset of assets.rows) {
      await deleteSource(asset.storage_path);
    }
    await withTransaction(async (client) => {
      await client.query("DELETE FROM users WHERE id = $1", [user.id]);
    });
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
