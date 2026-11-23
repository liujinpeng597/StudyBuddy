"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  leaving: boolean;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const VISIBLE_DURATION = 3200;
const FADE_DURATION = 360;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Set<number>>(new Set());

  useEffect(
    () => () => {
      for (const timer of timersRef.current) window.clearTimeout(timer);
      timersRef.current.clear();
    },
    []
  );

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delay);
    timersRef.current.add(timer);
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast))
      );
      schedule(
        () => setToasts((current) => current.filter((toast) => toast.id !== id)),
        FADE_DURATION
      );
    },
    [schedule]
  );

  const showToast = useCallback(
    (message: string, tone?: ToastTone) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      const id = crypto.randomUUID();
      const nextTone = tone ?? inferTone(trimmed);
      setToasts((current) => [
        ...current.filter((toast) => toast.message !== trimmed).slice(-2),
        { id, message: trimmed, tone: nextTone, leaving: false }
      ]);
      schedule(() => dismiss(id), VISIBLE_DURATION);
    },
    [dismiss, schedule]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const Icon =
            toast.tone === "success"
              ? CheckCircle2
              : toast.tone === "error"
                ? CircleAlert
                : Info;
          return (
            <div
              className={`toast-item toast-${toast.tone} ${toast.leaving ? "is-leaving" : ""}`}
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.5} />
              <span>{toast.message}</span>
              <button
                type="button"
                aria-label="关闭提示"
                className="toast-close"
                onClick={() => dismiss(toast.id)}
              >
                <X aria-hidden="true" size={15} strokeWidth={1.5} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

function inferTone(message: string): ToastTone {
  return /(失败|错误|不可用|不能|无法|未完成|请先|已用完|拒绝)/.test(message)
    ? "error"
    : "success";
}
