import { questions, styles, type Option, type StyleKey } from "@/data/questions";

export type AnsweredQuestion = { question: string; answer: string };

export type ScoreResult = {
  resultType: StyleKey;
  scores: Record<StyleKey, number>;
  answered: AnsweredQuestion[];
};

// 驗證答案並計分；答案格式不對時回傳錯誤訊息
export function scoreAnswers(
  answers: unknown
): { ok: true; data: ScoreResult } | { ok: false; message: string } {
  if (!Array.isArray(answers)) {
    return { ok: false, message: "answers 必須是陣列，例如 [\"q1a\", \"q2b\", ...]" };
  }
  if (answers.length !== questions.length) {
    return {
      ok: false,
      message: `需要 ${questions.length} 題答案，但收到 ${answers.length} 題`,
    };
  }

  const styleKeys = Object.keys(styles) as StyleKey[];
  const scores = Object.fromEntries(styleKeys.map((k) => [k, 0])) as Record<StyleKey, number>;
  const answered: AnsweredQuestion[] = [];

  for (const [i, question] of questions.entries()) {
    const option: Option | undefined = question.options.find((o) => o.id === answers[i]);
    if (!option) {
      const validIds = question.options.map((o) => o.id).join(", ");
      return {
        ok: false,
        message: `第 ${i + 1} 題的答案「${String(answers[i])}」無效，可用的選項是：${validIds}`,
      };
    }
    for (const [style, weight] of Object.entries(option.weights) as [StyleKey, number][]) {
      scores[style] += weight;
    }
    answered.push({ question: question.text, answer: option.text });
  }

  // 同分時取 styles 裡排在前面的
  const resultType = styleKeys.reduce((best, k) => (scores[k] > scores[best] ? k : best));

  return { ok: true, data: { resultType, scores, answered } };
}
