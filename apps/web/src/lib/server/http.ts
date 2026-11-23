import { NextResponse } from "next/server";
import { getServerEnv } from "@studybuddy/core";

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const env = getServerEnv();
  if (origin === env.APP_URL) return;
  if (env.NODE_ENV !== "production") {
    const actual = new URL(origin);
    const configured = new URL(env.APP_URL);
    const localHosts = new Set(["localhost", "127.0.0.1"]);
    if (
      actual.protocol === configured.protocol &&
      actual.port === configured.port &&
      localHosts.has(actual.hostname) &&
      localHosts.has(configured.hostname)
    ) {
      return;
    }
  }
  throw new Error("请求来源不受信任");
}

export function errorResponse(error: unknown, fallback = "请求处理失败") {
  const message = error instanceof Error ? error.message : fallback;
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return jsonError("请先登录", 401, "UNAUTHORIZED");
  }
  if (message.includes("过于频繁")) {
    return jsonError(message, 429, "RATE_LIMITED");
  }
  return jsonError(message, 500, "INTERNAL_ERROR");
}
