import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { undoImport } from "@/lib/server/import-recovery";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    return NextResponse.json(await undoImport(user.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}
