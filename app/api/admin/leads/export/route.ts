import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/auth";
import { LeadModel } from "@/models/Lead";

// 檔名日期與填答時間都用台灣時間，不受伺服器所在時區影響
const TIME_ZONE = "Asia/Taipei";

function fail(status: number, code: string, message: string) {
  return Response.json({ status: "error", code, message }, { status });
}

// 回傳 { date: "2026-10-25", dateTime: "2026-10-25 15:37:01" }
function formatTaipei(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return { date: day, dateTime: `${day} ${parts.hour}:${parts.minute}:${parts.second}` };
}

// GET /api/admin/leads/export → 下載全部名單的 xlsx
export async function GET() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    console.error("[api/admin/leads/export] auth", err);
    return fail(503, "AUTH_UNAVAILABLE", "暫時無法驗證登入狀態，請稍後再試");
  }
  if (!admin) {
    return fail(401, "UNAUTHORIZED", "尚未登入或登入已過期，請重新登入");
  }

  let docs;
  try {
    docs = await LeadModel.find({}, { email: 1, resultType: 1, createdAt: 1, updatedAt: 1 })
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .lean();
  } catch (err) {
    console.error("[api/admin/leads/export] query", err);
    return fail(500, "DB_QUERY_FAILED", "讀取名單失敗，詳細原因請看伺服器 log");
  }

  if (docs.length === 0) {
    return fail(404, "NO_DATA", "目前沒有任何名單可以下載");
  }

  const rows = docs.map((d) => {
    const filledAt = d.updatedAt ?? d.createdAt;
    return {
      Email: d.email,
      風格: d.resultType,
      填答時間: filledAt ? formatTaipei(filledAt).dateTime : "",
    };
  });

  const sheet = XLSX.utils.json_to_sheet(rows, { header: ["Email", "風格", "填答時間"] });
  sheet["!cols"] = [{ wch: 32 }, { wch: 10 }, { wch: 20 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "名單");
  const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });

  const filename = `leads-${formatTaipei(new Date()).date}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
