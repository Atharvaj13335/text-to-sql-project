import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

const feedbackSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, index: true },
    question: { type: String, required: true },
    generatedSql: { type: String, required: true },
    rating: { type: String, enum: ["UP", "DOWN"], required: true },
    correctedSql: { type: String },
    comment: { type: String },
  },
  { timestamps: true }
);

const Feedback = mongoose.models.Feedback || mongoose.model("Feedback", feedbackSchema);

export async function recordFeedback(data) {
  if (mongoose.connection.readyState === 1) {
    try {
      const doc = new Feedback(data);
      await doc.save();
      logger.info({ userEmail: data.userEmail, rating: data.rating }, "Feedback recorded in MongoDB.");
      return doc.toObject();
    } catch (err) {
      logger.error({ err: err.message }, "Failed to save feedback to MongoDB.");
    }
  }
  logger.info({ feedback: data }, "Feedback recorded in-memory (MongoDB offline).");
  return data;
}
