import mongoose, { type InferSchemaType, type Model } from "mongoose";

const LeadSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    answers: { type: [String], default: [] },
    // 分析全文
    result: { type: String, required: true },
    // 風格代號
    resultType: { type: String, required: true },
  },
  // updatedAt：同一個 email 重新填答時會更新，後台用它當「最後填答時間」
  { timestamps: true }
);

export type Lead = InferSchemaType<typeof LeadSchema>;

// 避免 hot reload 時重複註冊 model（OverwriteModelError）
export const LeadModel: Model<Lead> =
  (mongoose.models.Lead as Model<Lead>) ||
  mongoose.model<Lead>("Lead", LeadSchema);
