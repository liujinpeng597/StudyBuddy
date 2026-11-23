import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { hashToken } from "./security";

export const SESSION_COOKIE = "studybuddy_session";
export const SESSION_TTL_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10 || password.length > 256) {
    throw new Error("密码长度必须在 10 到 256 个字符之间");
  }
  return hash(password, {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function createSessionToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, tokenHash: hashToken(token), expiresAt };
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60
  };
}
