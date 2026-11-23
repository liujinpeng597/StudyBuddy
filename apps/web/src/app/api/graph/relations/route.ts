import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@studybuddy/db";
import { requireApiUser } from "@/lib/server/auth";
import { assertSameOrigin, errorResponse, jsonError } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const relationSchema = z.object({
  source: z.uuid(),
  target: z.uuid()
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    enforceRateLimit(`graph-connect:${user.id}`, 60, 60_000);
    const parsed = relationSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("连线参数不正确");
    if (parsed.data.source === parsed.data.target) return jsonError("不能连接同一个知识点");

    const nodes = await query<{ id: string }>(
      "SELECT id FROM knowledge_nodes WHERE user_id = $1 AND id = ANY($2::uuid[])",
      [user.id, [parsed.data.source, parsed.data.target]]
    );
    if (nodes.rowCount !== 2) return jsonError("知识点不存在", 404);

    const relation = await query<{
      id: string;
      source_id: string;
      target_id: string;
      type: string;
      confidence: number;
      origin: string;
      review_status: string;
    }>(
      `INSERT INTO knowledge_relations
         (user_id, source_id, target_id, type, confidence, origin, review_status)
       VALUES ($1, $2, $3, 'related', 1, 'manual', 'active')
       ON CONFLICT (user_id, source_id, target_id, type)
       DO UPDATE SET confidence = 1, origin = 'manual', review_status = 'active'
       RETURNING id, source_id, target_id, type, confidence::float8, origin, review_status`,
      [user.id, parsed.data.source, parsed.data.target]
    );
    const row = relation.rows[0]!;
    return NextResponse.json({
      edge: {
        id: row.id,
        source: row.source_id,
        target: row.target_id,
        type: row.type,
        confidence: row.confidence,
        origin: row.origin,
        needsReview: row.review_status === "needs_review"
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
