import { clearAdminCookie, revokeAdminTokens, verifyAdminToken, ADMIN_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  const session = await verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value).catch(() => null);
  if (session) {
    // 讓 token 在後端作廢，就算被複製走也不能再用
    try {
      await revokeAdminTokens(session);
    } catch (err) {
      console.error("[api/admin/logout] revoke", err);
      await clearAdminCookie();
      return Response.json(
        { status: "error", code: "REVOKE_FAILED", message: "已清除這台裝置的登入狀態，但資料庫連不上，舊憑證還沒作廢；若擔心外洩，請稍後重新登入再登出一次" },
        { status: 503 }
      );
    }
  }
  await clearAdminCookie();
  return Response.json({ status: "success" });
}
