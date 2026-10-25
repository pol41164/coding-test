"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type LeadItem = { email: string; resultType: string; filledAt: string | null };
type LeadsResponse = {
  status: string;
  message?: string;
  items: LeadItem[];
  page: number;
  total: number;
  totalPages: number;
};

const PAGE_SIZE = 20;

function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("zh-TW", { hour12: false }) : "—";
}

export default function LeadsTable({ adminEmail }: { adminEmail: string }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/leads?page=${page}&pageSize=${PAGE_SIZE}`, { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const json: LeadsResponse = await res.json().catch(() => ({
          status: "error",
          message: `伺服器回應格式錯誤（HTTP ${res.status}）`,
        }));
        if (cancelled) return;
        if (!res.ok || json.status !== "success") {
          setError(json.message || `讀取失敗（HTTP ${res.status}）`);
        } else {
          setData(json);
        }
      } catch {
        if (!cancelled) setError("網路連線失敗，請確認網路後再試一次");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey, router]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    router.replace("/admin/login");
  }

  // 檔案由後端產生；這裡只負責把回傳的檔案存下來，失敗時顯示原因
  async function handleDownload() {
    setDownloading(true);
    setDownloadError("");
    try {
      const res = await fetch("/api/admin/leads/export", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setDownloadError(json?.message || `下載失敗（HTTP ${res.status}）`);
        return;
      }
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "leads.xlsx";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("網路連線失敗，請確認網路後再試一次");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="!mb-0">名單</h1>
        <div className="flex items-center gap-3 text-sm opacity-80">
          <span className="break-all">{adminEmail}</span>
          <button onClick={handleLogout}>登出</button>
        </div>
      </div>

      {error && (
        <p role="alert">
          {error} <button onClick={() => setReloadKey((k) => k + 1)}>重試</button>
        </p>
      )}

      {data && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm opacity-80">
              共 {data.total} 筆{loading && "（載入中…）"}
            </span>
            <button onClick={handleDownload} disabled={data.total === 0 || downloading}>
              {downloading ? "產生檔案中…" : "下載 Excel"}
            </button>
          </div>
          {downloadError && <p role="alert">{downloadError}</p>}
          <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Email</th>
                <th>風格代號</th>
                <th>最後填答時間</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={4}>目前沒有資料</td>
                </tr>
              ) : (
                data.items.map((item, i) => (
                  <tr key={item.email}>
                    <td>{(data.page - 1) * PAGE_SIZE + i + 1}</td>
                    <td>{item.email}</td>
                    <td>{item.resultType}</td>
                    <td>{formatTime(item.filledAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
          <p className="mt-5 flex items-center justify-center gap-3 text-sm">
            <button onClick={() => setPage((p) => p - 1)} disabled={loading || page <= 1}>
              上一頁
            </button>{" "}
            第 {data.page} / {data.totalPages} 頁{" "}
            <button onClick={() => setPage((p) => p + 1)} disabled={loading || page >= data.totalPages}>
              下一頁
            </button>
          </p>
        </>
      )}

      {!data && loading && <p>載入中…</p>}
    </main>
  );
}
