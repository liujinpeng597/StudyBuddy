import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@studybuddy/core";
import { query } from "@studybuddy/db";
import { setSessionCookie } from "@/lib/server/auth";
import { assertSameOrigin, jsonError } from "@/lib/server/http";

const setupSchema = z.object({
  email: z.email(),
  password: z.string().min(10).max(256)
});

export async function POST(request: Request) {
  assertSameOrigin(request);
  const parsed = setupSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("请输入有效邮箱和至少 10 位密码");
  const count = await query<{ count: string }>("SELECT count(*)::text AS count FROM users");
  if (Number(count.rows[0]?.count ?? 0) > 0) return jsonError("账户已经初始化", 409);
  const passwordHash = await hashPassword(parsed.data.password);
  const created = await query<{ id: string; email: string }>(
    "INSERT INTO users (email, password_hash) VALUES (lower($1), $2) RETURNING id, email",
    [parsed.data.email, passwordHash]
  );
  const user = created.rows[0];
  if (!user) return jsonError("账户创建失败", 500);
  await setSessionCookie(user.id);
  return NextResponse.json({ user });
}
