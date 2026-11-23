import { NextResponse } from "next/server";
import { query } from "@studybuddy/db";
import { getSessionUser } from "@/lib/server/auth";

export async function GET() {
  const [user, count] = await Promise.all([
    getSessionUser(),
    query<{ count: string }>("SELECT count(*)::text AS count FROM users")
  ]);
  return NextResponse.json({
    hasUser: Number(count.rows[0]?.count ?? 0) > 0,
    authenticated: Boolean(user),
    email: user?.email ?? null
  });
}
