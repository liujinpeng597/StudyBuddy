import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@studybuddy/db";
import { requireApiUser } from "@/lib/server/auth";
import { assertSameOrigin, errorResponse, jsonError } from "@/lib/server/http";
import { getDisplayPreferences } from "@/lib/server/tree";

const preferenceSchema = z.object({
  directoryDefaultExpanded: z.boolean(),
  mindmapDefaultExpanded: z.boolean()
});

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json(await getDisplayPreferences(user.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const parsed = preferenceSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("展开设置参数不正确");
    await query(
      `INSERT INTO user_preferences
         (user_id, directory_default_expanded, mindmap_default_expanded)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET directory_default_expanded = EXCLUDED.directory_default_expanded,
           mindmap_default_expanded = EXCLUDED.mindmap_default_expanded,
           updated_at = now()`,
      [
        user.id,
        parsed.data.directoryDefaultExpanded,
        parsed.data.mindmapDefaultExpanded
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
