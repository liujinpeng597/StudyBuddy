import { NextResponse } from "next/server";
import { query } from "@studybuddy/db";
import { requireApiUser } from "@/lib/server/auth";
import { assertSameOrigin, errorResponse, jsonError } from "@/lib/server/http";
import {
  getProfileRow,
  profileInputSchema,
  toPublicProfile,
  updateProfile
} from "@/lib/server/models";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const parsed = profileInputSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("模型配置字段不完整");
    await updateProfile(user.id, id, parsed.data);
    return NextResponse.json({ profile: toPublicProfile(await getProfileRow(user.id, id)) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    await query("DELETE FROM ai_model_profiles WHERE user_id = $1 AND id = $2", [user.id, id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
