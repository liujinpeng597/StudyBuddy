import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";
import { regroupKnowledge } from "@/lib/server/knowledge-regroup";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    enforceRateLimit(`knowledge-regroup:${user.id}`, 5, 60 * 60_000);
    return NextResponse.json(await regroupKnowledge(user.id));
  } catch (error) {
    return errorResponse(error);
  }
}
