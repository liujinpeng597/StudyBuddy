import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { generateJson, type ResolvedModelProfile } from "./index";

const profile: ResolvedModelProfile = {
  id: "profile-1",
  userId: "user-1",
  displayName: "DeepSeek V4.1 Flash",
  baseUrl: "https://example.com/v1",
  modelId: "test-model",
  apiKey: "secret-key",
  capabilities: ["text", "json"]
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenAI-compatible adapter", () => {
  test("calls the configured endpoint and validates structured JSON", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe("https://example.com/v1/chat/completions");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer secret-key");
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"answer":"ok"}' } }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateJson(profile, z.object({ answer: z.string() }), {
      system: "json",
      user: "test"
    });
    expect(result.answer).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("rejects schema-invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: '{"wrong":true}' } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );
    await expect(
      generateJson(profile, z.object({ answer: z.string() }), {
        system: "json",
        user: "test"
      })
    ).rejects.toThrow("模型输出校验失败");
  });

  test("surfaces the provider error message without exposing the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: { message: "The supported API model names are deepseek-flash." }
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
    );
    await expect(
      generateJson(profile, z.object({ answer: z.string() }), {
        system: "json",
        user: "test"
      })
    ).rejects.toThrow("supported API model names");
  });

  test("disables DeepSeek thinking mode for latency-sensitive structured extraction", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { thinking?: { type?: string } };
      expect(body.thinking?.type).toBe("disabled");
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    await generateJson(
      { ...profile, baseUrl: "https://api.deepseek.com/v1" },
      z.object({ ok: z.boolean() }),
      { system: "json", user: "test" }
    );
  });
});
