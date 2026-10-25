import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import LeadsTable from "./LeadsTable";

// 要先驗證登入才能決定畫面，允許這頁等待請求而不是預先產生
export const instant = false;

// 沒登入就導回登入頁；真正保護資料的是 /api/admin/leads 的後端驗證
export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  return <LeadsTable adminEmail={admin.email} />;
}
