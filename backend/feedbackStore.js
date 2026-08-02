import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, index: true },
    chatId: { type: String, default: "" },
    question: { type: String, required: true },
    sql: { type: String, default: null },
    rating: { type: String, enum: ["up", "down"], required: true },
    comment: { type: String, default: "" },
    suggestedSql: { type: String, default: "" },
  },
  { timestamps: true }
);

const Feedback = mongoose.models.Feedback || mongoose.model("Feedback", feedbackSchema);

export async function recordFeedback({ userEmail, chatId, question, sql, rating, comment, suggestedSql }) {
  const entry = new Feedback({
    userEmail: userEmail || "anonymous",
    chatId: chatId || "",
    question,
    sql: sql || null,
    rating,
    comment: comment || "",
    suggestedSql: suggestedSql || "",
  });
  await entry.save();
  return entry;
}
