"use client"; // Error boundary 必須是 Client Component

import { useEffect } from "react";

// 畫面程式出錯時顯示這頁，避免白畫面
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="admin">
      <h2>頁面發生錯誤</h2>
      <p>很抱歉，畫面載入時出了問題。可以先重試，或重新整理頁面。</p>
      <button onClick={() => retry()}>重試</button>
    </main>
  );
}
