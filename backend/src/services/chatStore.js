import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ["user", "ai"], required: true },
  text: { type: String, required: true },
  sql: { type: String },
  data: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema({
  title: { type: String, required: true, default: "New Chat" },
  userEmail: { type: String, required: true, index: true },
  messages: [messageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Chat = mongoose.models.Chat || mongoose.model("Chat", chatSchema);

const memoryChats = new Map();

export async function getAllChats(userEmail) {
  if (!userEmail) return [];
  const normalizedEmail = userEmail.toLowerCase().trim();

  if (mongoose.connection.readyState === 1) {
    return await Chat.find({ userEmail: normalizedEmail }).sort({ updatedAt: -1 }).lean();
  } else {
    const userChats = Array.from(memoryChats.values()).filter((c) => c.userEmail === normalizedEmail);
    return userChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
}

export async function getChatById(chatId, userEmail) {
  if (!userEmail) return null;
  const normalizedEmail = userEmail.toLowerCase().trim();

  if (mongoose.connection.readyState === 1) {
    return await Chat.findOne({ _id: chatId, userEmail: normalizedEmail }).lean();
  } else {
    const chat = memoryChats.get(chatId);
    if (chat && chat.userEmail === normalizedEmail) return chat;
    return null;
  }
}

export async function createChat(userEmail, firstMessageText = "New Chat") {
  if (!userEmail) throw new Error("userEmail is required to create a chat.");
  const normalizedEmail = userEmail.toLowerCase().trim();
  const title = firstMessageText.length > 30 ? firstMessageText.substring(0, 30) + "..." : firstMessageText;

  if (mongoose.connection.readyState === 1) {
    const newChat = new Chat({
      title,
      userEmail: normalizedEmail,
      messages: [],
    });
    await newChat.save();
    return newChat.toObject();
  } else {
    const id = "mem_chat_" + Date.now();
    const chat = {
      _id: id,
      title,
      userEmail: normalizedEmail,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryChats.set(id, chat);
    return chat;
  }
}

export async function updateChat(chatId, userEmail, updatePayload) {
  if (!userEmail) throw new Error("userEmail is required to update a chat.");
  const normalizedEmail = userEmail.toLowerCase().trim();

  if (mongoose.connection.readyState === 1) {
    const chat = await Chat.findOne({ _id: chatId, userEmail: normalizedEmail });
    if (!chat) return null;

    if (updatePayload.title) chat.title = updatePayload.title;
    if (updatePayload.messages) chat.messages = updatePayload.messages;
    chat.updatedAt = new Date();

    await chat.save();
    return chat.toObject();
  } else {
    const chat = memoryChats.get(chatId);
    if (!chat || chat.userEmail !== normalizedEmail) return null;

    if (updatePayload.title) chat.title = updatePayload.title;
    if (updatePayload.messages) chat.messages = updatePayload.messages;
    chat.updatedAt = new Date();

    memoryChats.set(chatId, chat);
    return chat;
  }
}

export async function deleteChat(chatId, userEmail) {
  if (!userEmail) return false;
  const normalizedEmail = userEmail.toLowerCase().trim();

  if (mongoose.connection.readyState === 1) {
    const result = await Chat.deleteOne({ _id: chatId, userEmail: normalizedEmail });
    return result.deletedCount > 0;
  } else {
    const chat = memoryChats.get(chatId);
    if (chat && chat.userEmail === normalizedEmail) {
      memoryChats.delete(chatId);
      return true;
    }
    return false;
  }
}
