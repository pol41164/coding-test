"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { questions, quizMeta, styles, type StyleKey } from "@/data/questions";
import { isValidEmail, normalizeEmail } from "@/lib/email";

// scores：/api/analyze 本來就會回傳，結果頁拿來畫分數條
type Analysis = { resultType: StyleKey; analysis: string; scores?: Partial<Record<StyleKey, number>> };

// 流程：intro → question → email → loading → result
// 失敗時停在 error，可以重試失敗的那一步
type Step =
  | { name: "intro" }
  | { name: "question"; index: number }
  | { name: "email" }
  | { name: "loading"; message: string }
  | { name: "error"; message: string }
  | { name: "result" };

// 呼叫 API，失敗時丟出可以直接顯示給使用者的錯誤訊息
async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("網路連線失敗，請確認網路後再試一次");
  }

  let data: { status?: string; message?: string } & T;
  try {
    data = await res.json();
  } catch {
    throw new Error(`伺服器回應格式錯誤（HTTP ${res.status}），請稍後再試`);
  }

  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || `請求失敗（HTTP ${res.status}）`);
  }
  return data;
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];
// 點選項後先亮一下再換題，讓使用者看得到自己選了什麼
const SELECT_DELAY_MS = 220;
const estimatedMinutes = Math.max(1, Math.round((questions.length * 15) / 60));

/* ───────────── 共用的外觀元件 ───────────── */

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="quiz-bg relative flex min-h-dvh w-full flex-1 flex-col items-center overflow-x-hidden px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex w-full max-w-xl flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

function Orb({ size = "lg", pulse = false }: { size?: "sm" | "lg"; pulse?: boolean }) {
  const ring = size === "lg" ? "size-36 sm:size-40" : "size-24";
  const ball = size === "lg" ? "size-20 sm:size-24" : "size-14";
  return (
    <div className={`orb-ring mx-auto flex items-center justify-center rounded-full ${ring}`}>
      <div className={`orb flex items-center justify-center rounded-full ${ball} ${pulse ? "animate-pulse-glow" : "animate-float"}`}>
        <svg viewBox="0 0 40 40" className="w-3/5" aria-hidden="true">
          <ellipse cx="13.5" cy="15" rx="3.2" ry="4" fill="white" fillOpacity="0.9" />
          <ellipse cx="26.5" cy="15" rx="3.2" ry="4" fill="white" fillOpacity="0.9" />
          <path d="M12 24 Q20 31 28 24" stroke="white" strokeOpacity="0.9" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    </div>
  );
}

function GhostButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-violet-100 transition hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`btn-primary inline-flex items-center justify-center gap-3 rounded-2xl px-10 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={total}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-indigo-400 shadow-[0_0_12px_rgb(192_132_252/0.8)] transition-[width] duration-500 ease-out"
        style={{ width: `${(current / total) * 100}%` }}
      />
    </div>
  );
}

/* ───────────── 主流程 ───────────── */

export default function Quiz() {
  const [step, setStep] = useState<Step>({ name: "intro" });
  const [answers, setAnswers] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  // 分析成功但存檔失敗時，重試只需要重打 /api/leads，不用再花一次 AI 的錢
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  // 純畫面用：剛點下去、正在亮起的選項
  const [picked, setPicked] = useState<string | null>(null);

  function restart() {
    setStep({ name: "intro" });
    setAnswers([]);
    setEmail("");
    setEmailError("");
    setAnalysis(null);
  }

  function choose(index: number, optionId: string) {
    const next = [...answers.slice(0, index), optionId];
    setAnswers(next);
    // 答案改了，之前的分析就不能用
    setAnalysis(null);
    setStep(index + 1 < questions.length ? { name: "question", index: index + 1 } : { name: "email" });
  }

  function pick(index: number, optionId: string) {
    if (picked) return;
    setPicked(optionId);
    setTimeout(() => {
      setPicked(null);
      choose(index, optionId);
    }, SELECT_DELAY_MS);
  }

  async function submit() {
    try {
      let result = analysis;
      if (!result) {
        setStep({ name: "loading", message: "AI 正在分析你的答案，大約需要 5～10 秒…" });
        result = await postJson<Analysis>("/api/analyze", { answers });
        setAnalysis(result);
      }

      setStep({ name: "loading", message: "正在儲存結果…" });
      await postJson("/api/leads", {
        email: normalizeEmail(email),
        answers,
        result: result.analysis,
        resultType: result.resultType,
      });

      setStep({ name: "result" });
    } catch (err) {
      setStep({
        name: "error",
        message: err instanceof Error ? err.message : "發生未知錯誤，請再試一次",
      });
    }
  }

  function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(normalizeEmail(email))) {
      setEmailError("請輸入有效的 Email，例如 name@example.com");
      return;
    }
    setEmailError("");
    submit();
  }

  if (step.name === "intro") {
    return (
      <Shell>
        <section className="animate-enter text-center">
          <Orb />
          <h1 className="font-display mt-8 text-[clamp(2rem,7vw,3.25rem)] font-bold leading-[1.2] tracking-tight text-balance text-white">
            {quizMeta.title}
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-pretty text-violet-100/75 sm:text-lg">
            {quizMeta.description}答完留下 Email，AI 會依照你的作答寫一段專屬分析。
          </p>

          <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-100">
            <span>❓ {questions.length} 題</span>
            <span className="size-1 rounded-full bg-violet-300/50" />
            <span>⏱ 約 {estimatedMinutes} 分鐘</span>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {Object.keys(styles).map((name) => (
              <span key={name} className="rounded-full bg-white/5 px-3 py-1 text-xs text-violet-200/80 ring-1 ring-white/10">
                {name}
              </span>
            ))}
          </div>

          <PrimaryButton className="mt-10 w-full sm:w-auto" onClick={() => setStep({ name: "question", index: 0 })}>
            <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden="true">
              <path d="M4 2.5v11l9-5.5z" />
            </svg>
            開始測驗
          </PrimaryButton>
          <p className="mt-5 text-xs text-violet-200/50">免費 · 無需註冊 · AI 即時分析</p>
        </section>
      </Shell>
    );
  }

  if (step.name === "question") {
    const question = questions[step.index];
    return (
      <Shell>
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => setStep({ name: "question", index: step.index - 1 })}
            disabled={step.index === 0 || !!picked}
            className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-violet-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 ${step.index === 0 ? "invisible" : ""}`}
            aria-label="上一題"
          >
            ←
          </button>
          <ProgressBar current={step.index} total={questions.length} />
          <span className="font-display shrink-0 text-sm font-semibold tabular-nums text-violet-200/80">
            {step.index + 1} / {questions.length}
          </span>
        </div>

        {/* key 換掉就會重新播放進場動畫 */}
        <section key={step.index} className="animate-enter">
          <p className="font-display text-sm font-semibold tracking-widest text-fuchsia-300/90">Q{step.index + 1}</p>
          <h2 className="mt-2 text-[clamp(1.4rem,5vw,1.9rem)] font-bold leading-snug text-balance text-white">{question.text}</h2>

          <ul className="mt-8 space-y-3">
            {question.options.map((option, i) => {
              const isPicked = picked === option.id;
              const wasChosen = !picked && answers[step.index] === option.id;
              return (
                <li key={option.id}>
                  <button
                    onClick={() => pick(step.index, option.id)}
                    disabled={!!picked}
                    className={`group flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition duration-200 sm:px-5 ${
                      isPicked || wasChosen
                        ? "border-fuchsia-400/70 bg-fuchsia-500/15 shadow-[0_0_24px_-6px_rgb(217_70_239/0.7)]"
                        : "border-white/10 bg-white/[0.04] hover:-translate-y-0.5 hover:border-violet-400/50 hover:bg-white/[0.07]"
                    } ${isPicked ? "scale-[0.99]" : ""}`}
                  >
                    <span
                      className={`font-display flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition ${
                        isPicked || wasChosen
                          ? "bg-gradient-to-br from-fuchsia-400 to-violet-500 text-white"
                          : "bg-white/10 text-violet-200 group-hover:bg-violet-500/30"
                      }`}
                    >
                      {OPTION_LETTERS[i]}
                    </span>
                    <span className="text-[15px] leading-relaxed text-violet-50 sm:text-base">{option.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </Shell>
    );
  }

  if (step.name === "email") {
    return (
      <Shell>
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => setStep({ name: "question", index: questions.length - 1 })}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-violet-100 transition hover:bg-white/10"
            aria-label="上一題"
          >
            ←
          </button>
          <ProgressBar current={questions.length} total={questions.length} />
          <span className="font-display shrink-0 text-sm font-semibold text-violet-200/80">完成</span>
        </div>

        <section className="animate-enter rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur sm:p-10">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-violet-600/30 text-2xl ring-1 ring-white/15">
            ✉️
          </div>
          <h2 className="mt-5 text-[clamp(1.4rem,5vw,1.75rem)] font-bold text-white">最後一步，解鎖你的結果</h2>
          <p className="mt-2 text-sm leading-relaxed text-violet-100/70 sm:text-base">留下 Email，馬上看到 AI 為你寫的專屬分析</p>

          <form onSubmit={handleEmailSubmit} noValidate className="mt-7 text-left">
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-violet-100/80">
              Email
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoFocus
              aria-invalid={!!emailError}
              className={`w-full rounded-xl border bg-black/20 px-4 py-3.5 text-base text-white placeholder:text-violet-200/30 transition focus:outline-none focus:ring-4 ${
                emailError
                  ? "border-rose-400/70 focus:ring-rose-500/20"
                  : "border-white/15 focus:border-violet-400 focus:ring-violet-500/25"
              }`}
            />
            {emailError && (
              <p role="alert" className="mt-2 text-sm text-rose-300">
                {emailError}
              </p>
            )}
            <PrimaryButton type="submit" className="mt-6 w-full">
              看我的分析結果 →
            </PrimaryButton>
          </form>
        </section>
      </Shell>
    );
  }

  if (step.name === "loading") {
    return (
      <Shell>
        <section className="animate-enter text-center">
          <div className="relative mx-auto w-fit">
            <Orb pulse />
            <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-fuchsia-300/80 [animation-duration:1.4s]" />
          </div>
          <p aria-live="polite" className="mt-8 text-lg font-medium text-violet-50">
            {step.message}
          </p>
          <p className="mt-2 text-sm text-violet-200/50">請不要關閉這個頁面</p>
        </section>
      </Shell>
    );
  }

  if (step.name === "error") {
    return (
      <Shell>
        <section className="animate-enter rounded-3xl border border-rose-400/20 bg-rose-500/[0.06] p-6 text-center sm:p-10">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-500/15 text-2xl ring-1 ring-rose-300/25">
            ⚠️
          </div>
          <h2 className="mt-5 text-2xl font-bold text-white">出了點問題</h2>
          <p role="alert" className="mx-auto mt-3 max-w-sm break-words text-sm leading-relaxed text-rose-100/85 sm:text-base">
            {step.message}
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <PrimaryButton onClick={submit} className="w-full">
              再試一次
            </PrimaryButton>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <GhostButton onClick={() => setStep({ name: "email" })}>修改 Email</GhostButton>
              <GhostButton onClick={restart}>重新測驗</GhostButton>
            </div>
          </div>
        </section>
      </Shell>
    );
  }

  // result：只有 /api/leads 存檔成功後才會走到這裡
  if (!analysis) return null;
  const scoreEntries = analysis.scores
    ? (Object.keys(styles) as StyleKey[]).map((k) => [k, analysis.scores?.[k] ?? 0] as const)
    : [];
  const maxScore = Math.max(1, ...scoreEntries.map(([, s]) => s));

  return (
    <Shell>
      <section className="animate-enter mx-auto w-full max-w-md">
        {/* 這張卡片就是要被截圖的範圍 */}
        <div className="rounded-[28px] bg-gradient-to-b from-fuchsia-400/60 via-violet-500/25 to-indigo-500/50 p-px shadow-[0_30px_80px_-20px_rgb(168_85_247/0.55)]">
          <div className="relative overflow-hidden rounded-[27px] bg-[#170b2b] px-6 pb-7 pt-8 sm:px-8">
            <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-fuchsia-500/25 blur-3xl" />

            <div className="relative text-center">
              <span className="inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-[0.2em] text-violet-200/80">
                我的測驗結果
              </span>
              <div className="mt-5">
                <Orb size="sm" />
              </div>
              <p className="mt-4 text-sm text-violet-200/70">我是</p>
              <h1 className="font-display text-gradient mt-1 text-[clamp(2.75rem,12vw,3.75rem)] font-bold leading-none">
                {analysis.resultType}
              </h1>
              <p className="mx-auto mt-4 max-w-xs text-[15px] leading-relaxed text-balance text-violet-50/90">
                {styles[analysis.resultType].description}
              </p>
            </div>

            {scoreEntries.length > 0 && (
              <ul className="relative mt-7 space-y-2.5">
                {scoreEntries.map(([name, score]) => {
                  const isTop = name === analysis.resultType;
                  return (
                    <li key={name} className="flex items-center gap-3 text-sm">
                      <span className={`w-14 shrink-0 ${isTop ? "font-bold text-white" : "text-violet-200/70"}`}>{name}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${isTop ? "bg-gradient-to-r from-fuchsia-400 to-violet-400" : "bg-violet-300/40"}`}
                          style={{ width: `${(score / maxScore) * 100}%` }}
                        />
                      </div>
                      <span className={`font-display w-6 shrink-0 text-right tabular-nums ${isTop ? "text-white" : "text-violet-200/60"}`}>
                        {score}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="relative my-7 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative">
              <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-fuchsia-300/90">AI 個人化分析</p>
              <p className="whitespace-pre-line text-[15px] leading-7 text-violet-50/85">{analysis.analysis}</p>
            </div>

            <p className="relative mt-8 text-center text-xs text-violet-200/45">✦ {quizMeta.title} ✦</p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-violet-200/60">📸 截圖分享給朋友，看看他們是哪一派</p>
        <div className="mt-4 flex justify-center">
          <GhostButton onClick={restart}>↻ 重新測驗</GhostButton>
        </div>
      </section>
    </Shell>
  );
}
