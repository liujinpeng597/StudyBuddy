import { NextResponse } from "next/server";
import { z } from "zod";
import { hashToken, verifyPassword } from "@studybuddy/core";
import { query } from "@studybuddy/db";
import { setSessionCookie } from "@/lib/server/auth";
import { assertSameOrigin, jsonError } from "@/lib/server/http";

const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(256) });

export async function POST(request: Request) {
  assertSameOrigin(request);
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("邮箱或密码错误", 401);
  const identifier = hashToken(
    `${parsed.data.email.toLowerCase()}|${request.headers.get("x-forwarded-for") ?? "local"}`
  );
  const limit = await query<{ failures: number; window_started_at: Date }>(
    "SELECT failures, window_started_at FROM auth_login_attempts WHERE identifier_hash = $1",
    [identifier]
  );
  const row = limit.rows[0];
  if (row && row.failures >= 5 && Date.now() - new Date(row.window_started_at).getTime() < 15 * 60_000) {
    return jsonError("登录尝试过多，请稍后再试", 429);
  }
  const result = await query<{ id: string; email: string; password_hash: string }>(
    "SELECT id, email, password_hash FROM users WHERE email = lower($1)",
    [parsed.data.email]
  );
  const user = result.rows[0];
  const valid = user ? await verifyPassword(user.password_hash, parsed.data.password) : false;
  if (!user || !valid) {
    await query(
      `INSERT INTO auth_login_attempts (identifier_hash, failures)
       VALUES ($1, 1)
       ON CONFLICT (identifier_hash) DO UPDATE
       SET failures = CASE
         WHEN auth_login_attempts.window_started_at < now() - interval '15 minutes' THEN 1
         ELSE auth_login_attempts.failures + 1
       END,
       window_started_at = CASE
         WHEN auth_login_attempts.window_started_at < now() - interval '15 minutes' THEN now()
         ELSE auth_login_attempts.window_started_at
       END`,
      [identifier]
    );
    return jsonError("邮箱或密码错误", 401);
  }
  await query("DELETE FROM auth_login_attempts WHERE identifier_hash = $1", [identifier]);
  await setSessionCookie(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email } });
}
