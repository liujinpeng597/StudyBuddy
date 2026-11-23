import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { assertSameOrigin, errorResponse, jsonError } from "@/lib/server/http";
import {
  createProfile,
  listProfiles,
  profileInputSchema
} from "@/lib/server/models";

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json({ profiles: await listProfiles(user.id) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const parsed = profileInputSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("模型配置字段不完整");
    return NextResponse.json({ profile: await createProfile(user.id, parsed.data) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
