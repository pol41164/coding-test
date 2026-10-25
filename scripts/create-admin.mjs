// 一次性建立管理員帳號
//   npm run create-admin                 互動輸入 email 與密碼（密碼不會顯示）
//   npm run create-admin -- --force      已有管理員時，刪掉舊的重建（忘記密碼時用）
// 非互動環境可改用環境變數 ADMIN_EMAIL、ADMIN_PASSWORD
import nextEnv from "@next/env";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import readline from "node:readline";

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 跟 models/Admin.ts 保持一致
const AdminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const AdminModel = mongoose.models.Admin || mongoose.model("Admin", AdminSchema);

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // 輸入密碼時不把字元印到螢幕上
      rl._writeToOutput = (s) => {
        if (s.startsWith(question)) rl.output.write(question);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function readCredentials() {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    return { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
  }
  if (!process.stdin.isTTY) {
    throw new Error("請在終端機互動執行，或設定 ADMIN_EMAIL 和 ADMIN_PASSWORD 環境變數");
  }
  const email = await ask("管理員 Email：");
  const password = await ask(`密碼（至少 ${MIN_PASSWORD_LENGTH} 字元）：`, { hidden: true });
  const confirm = await ask("再輸入一次密碼：", { hidden: true });
  if (password !== confirm) throw new Error("兩次輸入的密碼不一樣");
  return { email, password };
}

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("請在 .env.local 設定 MONGODB_URI");

  const force = process.argv.includes("--force");
  const { email: rawEmail, password } = await readCredentials();
  const email = rawEmail.trim().toLowerCase();

  if (!EMAIL_RE.test(email)) throw new Error(`「${rawEmail}」不是有效的 email 格式`);
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`密碼至少要 ${MIN_PASSWORD_LENGTH} 個字元`);

  await mongoose.connect(uri);
  try {
    const existing = await AdminModel.countDocuments();
    if (existing > 0 && !force) {
      throw new Error("已經有管理員帳號了。如果要重建（例如忘記密碼），請加上 --force");
    }
    if (force) await AdminModel.deleteMany({});

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await AdminModel.create({ email, passwordHash });
    console.log(`✓ 已建立管理員：${email}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
