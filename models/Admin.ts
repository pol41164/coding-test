import mongoose, { type InferSchemaType, type Model } from "mongoose";

// 注意：scripts/create-admin.mjs 也定義了同樣的 schema，修改時要一起改
const AdminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    // bcrypt 雜湊，預設查詢不會帶出來，要用 .select("+passwordHash")
    passwordHash: { type: String, required: true, select: false },
    // 登出時加 1，讓之前發出的 JWT 全部失效
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type Admin = InferSchemaType<typeof AdminSchema>;

// 避免 hot reload 時重複註冊 model（OverwriteModelError）
export const AdminModel: Model<Admin> =
  (mongoose.models.Admin as Model<Admin>) ||
  mongoose.model<Admin>("Admin", AdminSchema);
