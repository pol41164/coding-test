import bcrypt from "bcryptjs";
import { setAdminCookie, signAdminToken } from "@/lib/auth";
import { normalizeEmail } from "@/lib/email";
import { connectDB } from "@/lib/mongodb";
import { AdminModel } from "@/models/Admin";

// 回應格式：
// 成功 { status: "success", email }，並設定 httpOnly cookie
// 失敗 { status: "error", code, message }
function fail(status: number, code: string, message: string) {
  return Response.json({ status: "error", code, message }, { status });
}

// 帳號不存在時也跑一次 bcrypt 比對，讓回應時間一致，避免被用來試探 email 是否存在
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  return (dummyHash ??= bcrypt.hash("dummy-password-for-timing", 12));
}

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "INVALID_JSON", "請求內容不是合法的 JSON");
  }

  const { email, password } = body ?? {};
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return fail(400, "MISSING_CREDENTIALS", "請輸入 Email 和密碼");
  }

  try {
    await connectDB();
  } catch (err) {
    console.error("[api/admin/login] connect", err);
    return fail(503, "DB_UNAVAILABLE", "無法連線到資料庫，請稍後再試");
  }

  const admin = await AdminModel.findOne({ email: normalizeEmail(email) }).select("+passwordHash");
  const passwordOk = await bcrypt.compare(password, admin?.passwordHash ?? (await getDummyHash()));

  // 不區分「帳號不存在」和「密碼錯誤」，避免洩漏管理員 email
  if (!admin || !passwordOk) {
    return fail(401, "INVALID_CREDENTIALS", "Email 或密碼錯誤");
  }

  try {
    const token = await signAdminToken({ id: admin.id, email: admin.email, ver: admin.tokenVersion ?? 0 });
    await setAdminCookie(token);
  } catch (err) {
    console.error("[api/admin/login] token", err);
    return fail(500, "TOKEN_FAILED", err instanceof Error ? err.message : "無法建立登入憑證");
  }

  return Response.json({ status: "success", email: admin.email });
}
