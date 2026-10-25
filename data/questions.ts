// 測驗內容設定檔：換測驗主題時只需要改這個檔案
// 1. 改 quizMeta 的標題與說明
// 2. 改 styles 的風格名稱與描述（key 就是計分用的風格代號）
// 3. 改 questions，每個選項的 weights 只能使用 styles 裡有的 key

export const quizMeta = {
  title: "你是哪一種 Coding 風格的人？",
  description: "8 題，測出你寫程式時的真實習慣。",
};

export const styles = {
  規劃派: { description: "動手前先想清楚架構，喜歡有條理、可預期的開發流程。" },
  直覺派: { description: "先寫再說，靠快速試錯找到答案，行動力十足。" },
  協作派: { description: "重視溝通與團隊，相信好的程式是一起討論出來的。" },
  鑽研派: { description: "追根究柢，喜歡搞懂底層原理，對品質與細節很講究。" },
} as const;

export type StyleKey = keyof typeof styles;

export type Option = {
  id: string;
  text: string;
  weights: Partial<Record<StyleKey, number>>;
};

export type Question = {
  id: string;
  text: string;
  options: Option[];
};

export const questions: Question[] = [
  {
    id: "q1",
    text: "接到一個全新的功能需求，你第一步會做什麼？",
    options: [
      { id: "q1a", text: "先畫流程圖、列出要做的步驟", weights: { 規劃派: 2 } },
      { id: "q1b", text: "直接開檔案寫一個能動的版本", weights: { 直覺派: 2 } },
      { id: "q1c", text: "找相關的人確認需求細節", weights: { 協作派: 2 } },
      { id: "q1d", text: "研究類似功能別人是怎麼實作的", weights: { 鑽研派: 2 } },
    ],
  },
  {
    id: "q2",
    text: "程式出現一個看不懂的 bug，你會？",
    options: [
      { id: "q2a", text: "照順序逐一排除可能原因", weights: { 規劃派: 2, 鑽研派: 1 } },
      { id: "q2b", text: "到處加 console.log，邊改邊試", weights: { 直覺派: 2 } },
      { id: "q2c", text: "拉同事一起看，或丟到群組問", weights: { 協作派: 2 } },
      { id: "q2d", text: "翻原始碼和文件，直到搞懂為止", weights: { 鑽研派: 2 } },
    ],
  },
  {
    id: "q3",
    text: "你的筆記或專案資料夾通常長什麼樣子？",
    options: [
      { id: "q3a", text: "分類清楚，命名有一套規則", weights: { 規劃派: 2 } },
      { id: "q3b", text: "有點亂，但我找得到", weights: { 直覺派: 2 } },
      { id: "q3c", text: "放在共享空間，大家都能看", weights: { 協作派: 2 } },
      { id: "q3d", text: "記滿了原理解析和參考連結", weights: { 鑽研派: 2 } },
    ],
  },
  {
    id: "q4",
    text: "學一個新框架時，你習慣怎麼開始？",
    options: [
      { id: "q4a", text: "先排好學習進度表", weights: { 規劃派: 2 } },
      { id: "q4b", text: "跟著範例做一個小專案", weights: { 直覺派: 2, 鑽研派: 1 } },
      { id: "q4c", text: "找朋友一起學或參加讀書會", weights: { 協作派: 2 } },
      { id: "q4d", text: "從官方文件第一頁讀起", weights: { 鑽研派: 2, 規劃派: 1 } },
    ],
  },
  {
    id: "q5",
    text: "離 deadline 只剩一天，功能還沒做完，你會？",
    options: [
      { id: "q5a", text: "重新排優先順序，先砍掉次要功能", weights: { 規劃派: 2 } },
      { id: "q5b", text: "火力全開，先求能動再說", weights: { 直覺派: 2 } },
      { id: "q5c", text: "跟團隊同步進度，請求支援", weights: { 協作派: 2 } },
      { id: "q5d", text: "寧可延期，也不想交出有問題的程式", weights: { 鑽研派: 2 } },
    ],
  },
  {
    id: "q6",
    text: "Code review 時，你最在意什麼？",
    options: [
      { id: "q6a", text: "架構是否清楚、好維護", weights: { 規劃派: 2 } },
      { id: "q6b", text: "功能有沒有正常運作", weights: { 直覺派: 2 } },
      { id: "q6c", text: "其他人看不看得懂", weights: { 協作派: 2 } },
      { id: "q6d", text: "效能和邊界情況有沒有處理好", weights: { 鑽研派: 2 } },
    ],
  },
  {
    id: "q7",
    text: "使用 AI 寫程式時，你通常怎麼下指令？",
    options: [
      { id: "q7a", text: "先寫好完整規格，再一步步請 AI 實作", weights: { 規劃派: 2 } },
      { id: "q7b", text: "想到什麼就問，不行就再換個說法", weights: { 直覺派: 2 } },
      { id: "q7c", text: "把 AI 當成討論夥伴，來回對話", weights: { 協作派: 2, 直覺派: 1 } },
      { id: "q7d", text: "會追問 AI 為什麼這樣寫", weights: { 鑽研派: 2 } },
    ],
  },
  {
    id: "q8",
    text: "完成一個專案後，你最有成就感的是？",
    options: [
      { id: "q8a", text: "一切照計畫準時完成", weights: { 規劃派: 2 } },
      { id: "q8b", text: "從無到有，很快就做出來了", weights: { 直覺派: 2 } },
      { id: "q8c", text: "大家合作愉快，一起達成目標", weights: { 協作派: 2 } },
      { id: "q8d", text: "過程中學到了很多新東西", weights: { 鑽研派: 2 } },
    ],
  },
];
