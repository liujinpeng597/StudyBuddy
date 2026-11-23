import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/today");
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-mark" src="/icons/studybuddy.svg" alt="" />
          <span className="brand-copy">
            <span className="brand-name">知伴</span>
            <span className="brand-tagline">学习搭子</span>
          </span>
        </div>
        <h1 id="login-title">把零散笔记织成知识网络</h1>
        <p className="muted">这是你的个人学习工作台。账户只在首次使用时创建。</p>
        <LoginForm />
      </section>
    </main>
  );
}
