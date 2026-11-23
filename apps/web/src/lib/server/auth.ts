import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  getServerEnv,
  hashToken,
  SESSION_COOKIE,
  sessionCookieOptions
} from "@studybuddy/core";
import { query } from "@studybuddy/db";

export type SessionUser = {
  id: string;
  email: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await query<{ id: string; email: string }>(
    `UPDATE sessions s
        SET last_used_at = now()
       FROM users u
      WHERE s.user_id = u.id
        AND s.token_hash = $1
        AND s.expires_at > now()
      RETURNING u.id, u.email`,
    [hashToken(token)]
  );
  return result.rows[0] ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const session = createSessionToken();
  await query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, session.tokenHash, session.expiresAt]
  );
  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    session.token,
    sessionCookieOptions(getServerEnv().NODE_ENV === "production")
  );
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
