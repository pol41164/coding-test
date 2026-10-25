import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import { quizMeta, styles } from "@/data/questions";
import { scoreAnswers } from "@/lib/quiz";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_CHARS = 300;

// 回應格式：
// 成功 { status: "success", resultType, analysis, scores }
// 失敗 { status: "error", code, message }
// 「等待中」是前端送出請求到收到回應之間的狀態；後端設有逾時，不會無限等待
function fail(status: number, code: string, message: string) {
  return Response.json({ status: "error", code, message }, { status });
}

// 超過字數時，截到最後一個完整句子
function clampText(text: string): string {
  const chars = Array.from(text.trim());
  if (chars.length <= MAX_CHARS) return chars.join("");
  const cut = chars.slice(0, MAX_CHARS).join("");
  const lastStop = Math.max(...["。", "！", "？"].map((p) => cut.lastIndexOf(p)));
  return lastStop > 0 ? cut.slice(0, lastStop + 1) : cut;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fail(500, "MISSING_API_KEY", "伺服器沒有設定 OPENAI_API_KEY，請檢查 .env.local");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "INVALID_JSON", "請求內容不是合法的 JSON");
  }

  const scored = scoreAnswers((body as { answers?: unknown } | null)?.answers);
  if (!scored.ok) {
    return fail(400, "INVALID_ANSWERS", scored.message);
  }
  const { resultType, scores, answered } = scored.data;

  const prompt = [
    `測驗主題：${quizMeta.title}`,
    `所有風格：${Object.entries(styles)
      .map(([name, s]) => `${name}（${s.description}）`)
      .join("、")}`,
    `計分結果：${Object.entries(scores)
      .map(([name, score]) => `${name} ${score} 分`)
      .join("、")}`,
    `最終風格：${resultType}`,
    "使用者的作答：",
    ...answered.map((a, i) => `${i + 1}. ${a.question} → ${a.answer}`),
  ].join("\n");

  const client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "你是一位親切的測驗分析師。根據使用者的作答與計分結果，用繁體中文寫一段個人化分析，" +
            "說明他為什麼是這個風格、優勢、可以留意的地方，並引用一兩個他的具體作答。" +
            "全文 250 字以內，不要使用標題、條列或 Markdown。",
        },
        { role: "user", content: prompt },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return fail(502, "EMPTY_RESPONSE", "OpenAI 沒有回傳分析內容，請稍後再試");
    }

    return Response.json({
      status: "success",
      resultType,
      analysis: clampText(text),
      scores,
    });
  } catch (err) {
    console.error("[api/analyze]", err);

    // 子類別要放在父類別之前判斷
    if (err instanceof APIConnectionTimeoutError) {
      return fail(504, "OPENAI_TIMEOUT", "OpenAI 回應逾時（超過 30 秒），請稍後再試");
    }
    if (err instanceof APIConnectionError) {
      return fail(502, "OPENAI_UNREACHABLE", "無法連線到 OpenAI，請檢查伺服器的網路連線");
    }
    if (err instanceof AuthenticationError) {
      return fail(502, "OPENAI_AUTH_FAILED", "OpenAI 金鑰無效或已失效，請確認 OPENAI_API_KEY");
    }
    if (err instanceof RateLimitError) {
      if (err.code === "insufficient_quota") {
        return fail(502, "OPENAI_QUOTA_EXCEEDED", "OpenAI 帳戶額度已用完，請到 OpenAI 後台確認帳單與額度");
      }
      return fail(429, "OPENAI_RATE_LIMITED", "請求太頻繁，被 OpenAI 限流了，請等一下再試");
    }
    if (err instanceof NotFoundError) {
      return fail(502, "OPENAI_MODEL_NOT_FOUND", `找不到模型「${MODEL}」，或這把金鑰沒有使用權限`);
    }
    if (err instanceof PermissionDeniedError) {
      return fail(502, "OPENAI_PERMISSION_DENIED", "這把 OpenAI 金鑰沒有權限執行此操作");
    }
    if (err instanceof APIError) {
      return fail(502, "OPENAI_ERROR", `OpenAI 回傳錯誤（${err.status ?? "未知狀態"}）：${err.message}`);
    }
    return fail(500, "INTERNAL_ERROR", "伺服器發生未預期的錯誤，詳細原因請看伺服器 log");
  }
}
