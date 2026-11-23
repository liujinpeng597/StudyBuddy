import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/auth";
import { createImportJob, listImportJobs } from "@/lib/server/imports";
import { assertSameOrigin, errorResponse, jsonError } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const createSchema = z.object({ studyDate: z.iso.date().optional() });

export async function GET() {
  try {
    const user = await requireApiUser();
    return NextResponse.json({ jobs: await listImportJobs(user.id) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    enforceRateLimit(`imports:${user.id}`, 20, 60 * 60_000);
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("学习日期格式不正确");
    const studyDate = parsed.data.studyDate ?? new Date().toISOString().slice(0, 10);
    const id = await createImportJob(user.id, studyDate);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
