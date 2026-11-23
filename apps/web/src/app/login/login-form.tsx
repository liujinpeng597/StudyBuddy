"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

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
      {hasUser === false ? (
        <span className="w-fit rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
          首次设置
        </span>
      ) : null}
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          邮箱
        </label>
        <input
          id="email"
          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-slate-700" htmlFor="password">
          密码
        </label>
        <input
          id="password"
          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white"
          type="password"
          autoComplete={hasUser ? "current-password" : "new-password"}
          placeholder={hasUser ? "输入密码" : "至少 10 个字符"}
          minLength={hasUser ? undefined : 10}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {hasUser === false ? (
          <span className="text-xs text-slate-500">密码至少 10 个字符</span>
        ) : null}
      </div>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-55"
        disabled={busy || hasUser === null}
        type="submit"
      >
        {busy ? (
          <LoaderCircle className="animate-spin" size={16} strokeWidth={1.5} />
        ) : (
          <ArrowRight size={16} strokeWidth={1.5} />
        )}
        {busy ? "请稍候" : hasUser === false ? "创建并进入" : "登录"}
      </button>
    </form>
  );
}
