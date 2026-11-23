import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";
import { testProfile } from "@/lib/server/models";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    enforceRateLimit(`model-test:${user.id}`, 20, 60 * 60_000);
    const { id } = await context.params;
    return NextResponse.json(await testProfile(user.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}
