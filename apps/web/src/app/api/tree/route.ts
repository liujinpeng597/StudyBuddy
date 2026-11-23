import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { errorResponse, jsonError } from "@/lib/server/http";
import { getKnowledgeTree } from "@/lib/server/tree";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json(await getKnowledgeTree(user.id));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    return errorResponse(error);
  }
}
