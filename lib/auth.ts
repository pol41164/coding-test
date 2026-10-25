import { jwtVerify, SignJWT } from "jose";
import mongoose from "mongoose";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/mongodb";
import { AdminModel } from "@/models/Admin";

export const ADMIN_COOKIE = "admin_token";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 天

// ver：簽發時管理員的 tokenVersion，登出後版本加 1，舊 token 就對不上
export type AdminSession = { id: string; email: string; ver: number };

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET 沒有設定或長度不足 32 字元，請檢查 .env.local");
  }
  return new TextEncoder().encode(secret);
}

export async function signAdminToken(admin: AdminSession): Promise<string> {
  return new SignJWT({ email: admin.email, role: "admin", ver: admin.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

// token 無效、過期或被竄改時回傳 null
export async function verifyAdminToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const { role, sub, email, ver } = payload;
    if (role !== "admin" || !sub || typeof email !== "string" || typeof ver !== "number") return null;
    return { id: sub, email, ver };
  } catch {
    return null;
  }
}

export async function setAdminCookie(token: string) {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true, // 前端 JS 讀不到，防止 XSS 偷 token
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}

// 只驗證 JWT 簽章與期限，不查資料庫（登出後被複製走的 token 這裡仍會通過）
export async function getCurrentAdmin(): Promise<AdminSession | null> {
  return verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

// 驗證 JWT，並確認管理員還存在、tokenVersion 也對得上
// 登出或用 --force 重建帳號後，舊 token 都會在這裡被擋下。保護後台資料一律用這個
export async function requireAdmin(): Promise<AdminSession | null> {
  const session = await getCurrentAdmin();
  if (!session || !mongoose.isValidObjectId(session.id)) return null;
  await connectDB();
  // 舊資料沒有 tokenVersion 欄位，視同 0
  const exists = await AdminModel.exists({
    _id: session.id,
    tokenVersion: session.ver === 0 ? { $in: [0, null] } : session.ver,
  });
  return exists ? session : null;
}

// 登出：版本加 1，讓這個管理員之前發出的所有 token 失效
export async function revokeAdminTokens(session: AdminSession) {
  if (!mongoose.isValidObjectId(session.id)) return;
  await connectDB();
  await AdminModel.updateOne({ _id: session.id }, { $inc: { tokenVersion: 1 } });
}
