import { describe, expect, test } from "vitest";
import { SecretBox, assertSafeModelUrl, maskSecret } from "./security";

const key = Buffer.from("studybuddy-dev-key-is-not-secret").toString("base64");

describe("SecretBox", () => {
  test("round-trips and rejects tampering or the wrong context", () => {
    const box = new SecretBox("v1", JSON.stringify({ v1: key }));
    const encrypted = box.encrypt("secret-value", "profile-a");
    expect(box.decrypt(encrypted, "profile-a")).toBe("secret-value");
    expect(() => box.decrypt(encrypted, "profile-b")).toThrow();
    const tampered = Buffer.from(encrypted);
    const tamperIndex = tampered.length - 3;
    tampered[tamperIndex] = (tampered[tamperIndex] ?? 0) ^ 1;
    expect(() => box.decrypt(tampered, "profile-a")).toThrow();
  });

  test("masks all but the last four characters", () => {
    expect(maskSecret("abcdefghijkl")).toBe("••••ijkl");
  });

  test("blocks metadata and private model endpoints", async () => {
    await expect(assertSafeModelUrl("http://169.254.169.254/latest")).rejects.toThrow();
    await expect(assertSafeModelUrl("https://127.0.0.1/v1")).rejects.toThrow();
    await expect(assertSafeModelUrl("https://192.168.1.2/v1")).rejects.toThrow();
    await expect(assertSafeModelUrl("http://localhost:11434/v1", true)).resolves.toBeInstanceOf(URL);
  });
});
