import { requireAdmin } from "@/lib/auth";
import { LeadModel } from "@/models/Lead";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// GET /api/admin/leads?page=1&pageSize=20
// 成功 { status: "success", items: [{ email, resultType, filledAt }], page, pageSize, total, totalPages }
// 失敗 { status: "error", code, message }
function fail(status: number, code: string, message: string) {
  return Response.json({ status: "error", code, message }, { status });
}

function parsePositiveInt(value: string | null, fallback: number): number | null {
  if (value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export async function GET(request: Request) {
  // 一定先在後端驗證登入，沒有合法憑證就不碰任何名單資料
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    console.error("[api/admin/leads] auth", err);
    return fail(503, "AUTH_UNAVAILABLE", "暫時無法驗證登入狀態，請稍後再試");
  }
  if (!admin) {
    return fail(401, "UNAUTHORIZED", "尚未登入或登入已過期，請重新登入");
  }

  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
  if (page === null || pageSize === null) {
    return fail(400, "INVALID_PAGINATION", "page 和 pageSize 必須是正整數");
  }
  if (pageSize > MAX_PAGE_SIZE) {
    return fail(400, "INVALID_PAGINATION", `pageSize 最多 ${MAX_PAGE_SIZE}`);
  }

  try {
    const [total, docs] = await Promise.all([
      LeadModel.countDocuments(),
      LeadModel.find({}, { email: 1, resultType: 1, createdAt: 1, updatedAt: 1 })
        .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const items = docs.map((d) => ({
      email: d.email,
      resultType: d.resultType,
      // 舊資料沒有 updatedAt，就用 createdAt
      filledAt: (d.updatedAt ?? d.createdAt)?.toISOString() ?? null,
    }));

    return Response.json({
      status: "success",
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    console.error("[api/admin/leads] query", err);
    return fail(500, "DB_QUERY_FAILED", "讀取名單失敗，詳細原因請看伺服器 log");
  }
}
