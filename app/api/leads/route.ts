import mongoose from "mongoose";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { connectDB } from "@/lib/mongodb";
import { scoreAnswers } from "@/lib/quiz";
import { LeadModel } from "@/models/Lead";

const MAX_RESULT_LENGTH = 2000;

// 回應格式：
// 成功 { status: "success", action: "created" | "updated" }
// 失敗 { status: "error", code, message }
function fail(status: number, code: string, message: string) {
  return Response.json({ status: "error", code, message }, { status });
}

function upsertLead(email: string, answers: string[], result: string, resultType: string) {
  return LeadModel.findOneAndUpdate(
    { email },
    { $set: { answers, result, resultType } },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      includeResultMetadata: true,
      lean: true,
    }
  );
}

function isDuplicateKeyError(err: unknown) {
  return (err as { code?: number } | null)?.code === 11000;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return fail(400, "INVALID_BODY", "請求內容必須是 JSON 物件");
    }
    body = parsed;
  } catch {
    return fail(400, "INVALID_JSON", "請求內容不是合法的 JSON");
  }

  const { email: rawEmail, answers, result, resultType } = body;

  if (typeof rawEmail !== "string" || !rawEmail.trim()) {
    return fail(400, "INVALID_EMAIL", "請提供 email");
  }
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return fail(400, "INVALID_EMAIL", `「${rawEmail}」不是有效的 email 格式`);
  }

  const scored = scoreAnswers(answers);
  if (!scored.ok) {
    return fail(400, "INVALID_ANSWERS", scored.message);
  }

  // 任何人都能打這支 API，所以風格代號要跟答案重新計分的結果一致，避免被亂塞
  if (resultType !== scored.data.resultType) {
    return fail(
      400,
      "RESULT_TYPE_MISMATCH",
      `resultType「${String(resultType)}」跟答案算出來的「${scored.data.resultType}」不一致`
    );
  }

  if (typeof result !== "string" || !result.trim()) {
    return fail(400, "INVALID_RESULT", "請提供 result（分析全文）");
  }
  if (result.length > MAX_RESULT_LENGTH) {
    return fail(400, "INVALID_RESULT", `result 太長了，上限 ${MAX_RESULT_LENGTH} 字`);
  }

  try {
    await connectDB();
  } catch (err) {
    console.error("[api/leads] connect", err);
    return fail(503, "DB_UNAVAILABLE", "無法連線到資料庫，請檢查 MONGODB_URI 或資料庫是否在線");
  }

  const validAnswers = answers as string[];
  try {
    let res;
    try {
      res = await upsertLead(email, validAnswers, result.trim(), scored.data.resultType);
    } catch (err) {
      // 同一個 email 同時送出兩次時，其中一次 upsert 會撞到 unique index，再試一次就會變成更新
      if (!isDuplicateKeyError(err)) throw err;
      res = await upsertLead(email, validAnswers, result.trim(), scored.data.resultType);
    }

    const action = res.lastErrorObject?.updatedExisting ? "updated" : "created";
    return Response.json({ status: "success", action }, { status: action === "created" ? 201 : 200 });
  } catch (err) {
    console.error("[api/leads] upsert", err);
    if (err instanceof mongoose.Error.ValidationError) {
      return fail(400, "VALIDATION_FAILED", `資料格式不符：${err.message}`);
    }
    return fail(500, "DB_WRITE_FAILED", "寫入資料庫失敗，詳細原因請看伺服器 log");
  }
}
