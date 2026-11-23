import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { getImportDiff } from "@/lib/server/import-recovery";
import { errorResponse, jsonError } from "@/lib/server/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const diff = await getImportDiff(user.id, id);
    if (!diff) return jsonError("导入记录不存在", 404);
    return NextResponse.json(diff);
  } catch (error) {
    return errorResponse(error);
  }
}
