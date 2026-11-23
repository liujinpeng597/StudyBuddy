import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const SECRET_FORMAT_VERSION = 1;

type EncryptedEnvelope = {
  v: number;
  k: string;
  i: string;
  t: string;
  d: string;
};

function decodeKeyring(activeKeyId: string, encodedKeys: string): Map<string, Buffer> {
  const raw = JSON.parse(encodedKeys) as Record<string, string>;
  const keyring = new Map<string, Buffer>();
  for (const [id, encoded] of Object.entries(raw)) {
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) {
      throw new Error(`Secret-box key ${id} must decode to exactly 32 bytes`);
    }
    keyring.set(id, key);
  }
  if (!keyring.has(activeKeyId)) {
    throw new Error(`Secret-box active key ${activeKeyId} is missing`);
  }
  return keyring;
}

export class SecretBox {
  private readonly keyring: Map<string, Buffer>;

  constructor(
    private readonly activeKeyId: string,
    encodedKeys: string
  ) {
    this.keyring = decodeKeyring(activeKeyId, encodedKeys);
  }

  encrypt(plaintext: string, context: string): Buffer {
    const key = this.keyring.get(this.activeKeyId);
    if (!key) {
      throw new Error("Active secret-box key is unavailable");
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(context));
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const envelope: EncryptedEnvelope = {
      v: SECRET_FORMAT_VERSION,
      k: this.activeKeyId,
      i: iv.toString("base64"),
      t: cipher.getAuthTag().toString("base64"),
      d: ciphertext.toString("base64")
    };
    return Buffer.from(JSON.stringify(envelope), "utf8");
  }

  decrypt(payload: Buffer, context: string): string {
    const envelope = JSON.parse(payload.toString("utf8")) as EncryptedEnvelope;
    if (envelope.v !== SECRET_FORMAT_VERSION) {
      throw new Error("Unsupported secret-box envelope version");
    }
    const key = this.keyring.get(envelope.k);
    if (!key) {
      throw new Error(`Secret-box key ${envelope.k} is unavailable`);
    }
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.i, "base64"));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(envelope.t, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.d, "base64")),
      decipher.final()
    ]).toString("utf8");
  }
}

export function maskSecret(secret: string): string {
  const suffix = secret.slice(-4);
  return `••••${suffix}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeTokenEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

const blockedNetworks = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^224\./,
  /^240\./,
  /^::1$/i,
  /^fc/i,
  /^fd/i,
  /^fe80:/i
];

export async function assertSafeModelUrl(rawUrl: string, allowPrivate = false): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("模型地址必须使用 HTTPS");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("模型地址不能包含凭据、查询参数或片段");
  }
  if (allowPrivate && ["127.0.0.1", "localhost"].includes(url.hostname)) {
    return url;
  }
  if (url.protocol !== "https:") {
    throw new Error("非本地模型地址必须使用 HTTPS");
  }
  const addresses = isIP(url.hostname) ? [url.hostname] : (await lookup(url.hostname, { all: true })).map((entry) => entry.address);
  if (addresses.some((address) => blockedNetworks.some((pattern) => pattern.test(address)))) {
    throw new Error("模型地址不能指向私有或保留网络");
  }
  return url;
}
