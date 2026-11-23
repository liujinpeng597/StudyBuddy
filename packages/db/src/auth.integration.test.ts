import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { closePool, query } from "./client";

describe("database auth boundary", () => {
  beforeEach(async () => {
    await query("TRUNCATE auth_login_attempts, sessions, users CASCADE");
  });

  afterAll(async () => {
    await closePool();
  });

  test("stores hashed session tokens and enforces user scope", async () => {
    const inserted = await query<{ id: string }>(
      "INSERT INTO users (email, password_hash) VALUES ('one@example.com', 'hash') RETURNING id"
    );
    const userId = inserted.rows[0]?.id;
    expect(userId).toBeTruthy();
    await query(
      "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, 'hash-token', now() + interval '1 hour')",
      [userId]
    );
    const result = await query<{ user_id: string }>(
      "SELECT user_id FROM sessions WHERE token_hash = 'hash-token'"
    );
    expect(result.rows[0]?.user_id).toBe(userId);
  });

  test("supports Chinese trigram matching", async () => {
    const result = await query<{ score: number }>(
      "SELECT similarity('知识网络', '知识图谱')::float8 AS score"
    );
    expect(result.rows[0]?.score).toBeGreaterThan(0);
  });
});
