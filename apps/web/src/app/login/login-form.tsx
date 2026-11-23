"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((response) => response.json())
      .then((data) => {
        setHasUser(Boolean(data.hasUser));
        if (data.authenticated) router.replace("/today");
      })
      .catch(() => setHasUser(true));
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(hasUser ? "/api/auth/login" : "/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "操作失败");
      router.replace("/today");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      {hasUser === false ? <span className="badge accent">首次设置</span> : null}
      <div className="field">
        <label htmlFor="email">邮箱</label>
        <input
          id="email"
          className="input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">密码</label>
        <input
          id="password"
          className="input"
          type="password"
          autoComplete={hasUser ? "current-password" : "new-password"}
          minLength={hasUser ? undefined : 10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {hasUser === false ? <span className="muted">至少 10 个字符。</span> : null}
      </div>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <button className="button primary" disabled={busy || hasUser === null} type="submit">
        {busy ? "请稍候…" : hasUser === false ? "创建并进入" : "登录"}
      </button>
    </form>
  );
}
