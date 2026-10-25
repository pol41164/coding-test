"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

type ApiResult = { status?: string; message?: string; email?: string };

async function callApi(url: string, init?: RequestInit): Promise<{ ok: boolean; data: ApiResult }> {
  try {
    const res = await fetch(url, init);
    const data: ApiResult = await res.json().catch(() => ({ message: `伺服器回應格式錯誤（HTTP ${res.status}）` }));
    return { ok: res.ok && data.status === "success", data };
  } catch {
    return { ok: false, data: { message: "網路連線失敗，請確認網路後再試一次" } };
  }
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 已經登入就直接進後台
  useEffect(() => {
    callApi("/api/admin/me").then(({ ok }) => {
      if (ok) router.replace("/admin");
      else setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const { ok, data } = await callApi("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (ok) {
      router.replace("/admin");
      return;
    }
    setSubmitting(false);
    setError(data.message || "登入失敗，請再試一次");
  }

  if (checking) {
    return <main className="admin max-w-sm"><p>檢查登入狀態中…</p></main>;
  }

  return (
    <main className="admin max-w-sm pt-16">
      <h1>管理員登入</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-5">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </div>
        <div className="mb-6">
          <label htmlFor="password">密碼</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <button type="submit" disabled={submitting}>{submitting ? "登入中…" : "登入"}</button>
        {error && <p role="alert" className="mt-4">{error}</p>}
      </form>
    </main>
  );
}
