import mongoose from "mongoose";

const memoryStore = new Map();

const chatSchema = new mongoose.Schema(
  {
    chatId: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "New Chat" },
    messages: [
      {
        role: { type: String, required: true },
        content: { type: mongoose.Schema.Types.Mixed, required: true },
      },
    ],
  },
  { timestamps: true }
);

const Chat = mongoose.model("Chat", chatSchema);

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

// ---------------------------------------------------------------------------
// CRUD helpers (DB with in-memory fallback)
// ---------------------------------------------------------------------------

/** Return all chats (summary only: chatId, title, createdAt). Newest first. */
export async function getAllChats() {
  if (isDbConnected()) {
    return Chat.find({}, { chatId: 1, title: 1, createdAt: 1, _id: 0 })
      .sort({ createdAt: -1 })
      .lean();
  }
  return Array.from(memoryStore.values())
    .map(({ chatId, title, createdAt }) => ({ chatId, title, createdAt }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Return a single chat by chatId, including messages. */
export async function getChatById(chatId) {
  if (isDbConnected()) {
    return Chat.findOne({ chatId }, { _id: 0, __v: 0 }).lean();
  }
  return memoryStore.get(chatId) || null;
}

/** Create a new chat. Returns the saved document. */
export async function createChat({ chatId, title, messages }) {
  const item = {
    chatId,
    title: title || "New Chat",
    messages: messages || [],
    createdAt: new Date().toISOString(),
  };
  if (isDbConnected()) {
    const doc = new Chat(item);
    await doc.save();
    return { chatId: doc.chatId, title: doc.title, messages: doc.messages, createdAt: doc.createdAt };
  }
  memoryStore.set(chatId, item);
  return item;
}

/** Update a chat's title and/or messages. Returns the updated document. */
export async function updateChat(chatId, update) {
  if (isDbConnected()) {
    const allowed = {};
    if (update.title !== undefined) allowed.title = update.title;
    if (update.messages !== undefined) allowed.messages = update.messages;

    const doc = await Chat.findOneAndUpdate({ chatId }, { $set: allowed }, { new: true, lean: true });
    if (!doc) return null;
    return { chatId: doc.chatId, title: doc.title, messages: doc.messages, createdAt: doc.createdAt };
  }

  const existing = memoryStore.get(chatId);
  if (!existing) return null;
  if (update.title !== undefined) existing.title = update.title;
  if (update.messages !== undefined) existing.messages = update.messages;
  memoryStore.set(chatId, existing);
  return existing;
}

/** Delete a chat by chatId. Returns true if found and deleted. */
export async function deleteChat(chatId) {
  if (isDbConnected()) {
    const result = await Chat.deleteOne({ chatId });
    return result.deletedCount > 0;
  }
  return memoryStore.delete(chatId);
}
