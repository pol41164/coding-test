import { requireAdmin } from "@/lib/auth";

// 查目前是否已登入
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return Response.json({ status: "error", code: "UNAUTHORIZED", message: "尚未登入或登入已過期" }, { status: 401 });
    }
    return Response.json({ status: "success", email: admin.email });
  } catch (err) {
    console.error("[api/admin/me]", err);
    return Response.json(
      { status: "error", code: "AUTH_CONFIG_ERROR", message: err instanceof Error ? err.message : "驗證設定錯誤" },
      { status: 500 }
    );
  }
}
