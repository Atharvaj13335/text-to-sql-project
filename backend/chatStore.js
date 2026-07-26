import mongoose from "mongoose";

const memoryStore = new Map(); // key: chatId, value: chatObj with userEmail

const chatSchema = new mongoose.Schema(
  {
    chatId: { type: String, required: true, unique: true, index: true },
    userEmail: { type: String, required: true, index: true },
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
// CRUD helpers (Scoped by userEmail)
// ---------------------------------------------------------------------------

/** Return all chats for a specific userEmail (summary: chatId, title, createdAt). Newest first. */
export async function getAllChats(userEmail) {
  if (!userEmail) return [];
  if (isDbConnected()) {
    return Chat.find({ userEmail }, { chatId: 1, title: 1, createdAt: 1, _id: 0 })
      .sort({ createdAt: -1 })
      .lean();
  }
  return Array.from(memoryStore.values())
    .filter((item) => item.userEmail === userEmail)
    .map(({ chatId, title, createdAt }) => ({ chatId, title, createdAt }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Return a single chat by chatId and userEmail, including messages. */
export async function getChatById(chatId, userEmail) {
  if (!chatId || !userEmail) return null;
  if (isDbConnected()) {
    return Chat.findOne({ chatId, userEmail }, { _id: 0, __v: 0 }).lean();
  }
  const item = memoryStore.get(chatId);
  if (item && item.userEmail === userEmail) return item;
  return null;
}

/** Create a new chat for a user. Returns the saved document. */
export async function createChat({ chatId, userEmail, title, messages }) {
  if (!chatId || !userEmail) throw new Error("chatId and userEmail are required.");
  const item = {
    chatId,
    userEmail,
    title: title || "New Chat",
    messages: messages || [],
    createdAt: new Date().toISOString(),
  };
  if (isDbConnected()) {
    const doc = new Chat(item);
    await doc.save();
    return { chatId: doc.chatId, userEmail: doc.userEmail, title: doc.title, messages: doc.messages, createdAt: doc.createdAt };
  }
  memoryStore.set(chatId, item);
  return item;
}

/** Update a chat's title and/or messages if it belongs to userEmail. */
export async function updateChat(chatId, userEmail, update) {
  if (!chatId || !userEmail) return null;
  if (isDbConnected()) {
    const allowed = {};
    if (update.title !== undefined) allowed.title = update.title;
    if (update.messages !== undefined) allowed.messages = update.messages;

    const doc = await Chat.findOneAndUpdate({ chatId, userEmail }, { $set: allowed }, { new: true, lean: true });
    if (!doc) return null;
    return { chatId: doc.chatId, userEmail: doc.userEmail, title: doc.title, messages: doc.messages, createdAt: doc.createdAt };
  }

  const existing = memoryStore.get(chatId);
  if (!existing || existing.userEmail !== userEmail) return null;
  if (update.title !== undefined) existing.title = update.title;
  if (update.messages !== undefined) existing.messages = update.messages;
  memoryStore.set(chatId, existing);
  return existing;
}

/** Delete a chat by chatId if it belongs to userEmail. */
export async function deleteChat(chatId, userEmail) {
  if (!chatId || !userEmail) return false;
  if (isDbConnected()) {
    const result = await Chat.deleteOne({ chatId, userEmail });
    return result.deletedCount > 0;
  }
  const existing = memoryStore.get(chatId);
  if (existing && existing.userEmail === userEmail) {
    return memoryStore.delete(chatId);
  }
  return false;
}
