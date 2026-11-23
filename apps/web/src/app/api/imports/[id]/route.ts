import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { getImportJob } from "@/lib/server/imports";
import { errorResponse, jsonError } from "@/lib/server/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const job = await getImportJob(user.id, id);
    if (!job) return jsonError("导入记录不存在", 404);
    return NextResponse.json(job);
  } catch (error) {
    return errorResponse(error);
  }
}
