import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { uploadImportAsset } from "@/lib/server/imports";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("缺少上传文件");
    const asset = await uploadImportAsset(user.id, id, file);
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
