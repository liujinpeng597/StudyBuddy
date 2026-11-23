import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/auth";
import { LoginForm } from "./login-form";
import { LoginVisual } from "./login-visual";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/today");
  return (
    <main className="login-experience">
      <div className="login-shell">
        <section className="login-story" aria-labelledby="login-title">
          <div className="login-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-mark" src="/icons/studybuddy.svg" alt="" />
            <span className="brand-copy">
              <span className="brand-name">知伴</span>
              <span className="brand-tagline">学习搭子</span>
            </span>
          </div>

          <div className="login-intro-copy">
            <p className="login-kicker">个人知识工作台</p>
            <h1 id="login-title">
              把今天的笔记
              <span>整理成明天还会用的知识</span>
            </h1>
            <p>
              知伴会完善你的笔记、连接相关概念，再根据当天内容准备测试和错题复习。
            </p>
          </div>

          <LoginVisual />

          <div className="login-capabilities" aria-label="核心能力">
            <span>修正与整理</span>
            <span>知识网络</span>
            <span>测试与错题</span>
          </div>
        </section>

        <section className="login-access" aria-labelledby="login-access-title">
          <div className="login-access-inner">
            <div className="login-access-heading">
              <p>保持学习节奏</p>
              <h2 id="login-access-title">继续学习</h2>
              <span>登录后接着整理今天的笔记，或继续上次的复习。</span>
            </div>
            <LoginForm />
            <p className="login-local-note">你的学习数据只属于你</p>
          </div>
        </section>
      </div>
    </main>
  );
}
