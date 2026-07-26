import { useState, useEffect, useCallback } from "react";
import ChatInterface from "./components/ChatInterface.jsx";
import ParticleField from "./components/ParticleField.jsx";
import { History, Plus, MessageSquare, Trash2, X, Loader2 } from "lucide-react";

function genChatId() {
  return "chat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
}

function FullscreenBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-accent/20 blur-3xl animate-drift" />
      <div
        className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-gold/10 blur-3xl animate-drift"
        style={{ animationDelay: "4s", animationDuration: "24s" }}
      />
      <div
        className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full bg-aqua/10 blur-3xl animate-drift"
        style={{ animationDelay: "8s", animationDuration: "27s" }}
      />
      <ParticleField density={160} />
    </div>
  );
}

function SidebarHistory({ isOpen, onClose, chats, activeChatId, onSelectChat, onNewChat, onDeleteChat, loading }) {
  if (!isOpen) return null;

  return (
    <div className="fixed top-4 left-4 bottom-4 w-72 z-30 bg-panel/85 border border-white/15 rounded-2xl backdrop-blur-2xl flex flex-col p-4 shadow-2xl animate-pop-up">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white font-medium text-[14px]">
          <History size={16} className="text-accent" />
          <span>Past Conversations</span>
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          title="Close Sidebar"
        >
          <X size={16} />
        </button>
      </div>

      <button
        onClick={onNewChat}
        className="mt-3.5 flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-accent/20 hover:bg-accent/30 border border-accent/40 text-white font-medium text-[13px] transition-all duration-200 shadow-sm hover:shadow-[0_0_20px_-4px_rgba(124,140,255,0.4)]"
      >
        <Plus size={16} /> New Chat
      </button>

      <div className="flex-1 overflow-y-auto mt-3.5 space-y-1.5 pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-white/40">
            <Loader2 size={18} className="animate-spin text-accent" />
          </div>
        ) : chats.length === 0 ? (
          <p className="text-center text-white/40 text-[12px] py-6 font-mono">No past conversations</p>
        ) : (
          chats.map((c) => {
            const isActive = c.chatId === activeChatId;
            return (
              <div
                key={c.chatId}
                onClick={() => onSelectChat(c.chatId)}
                className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                  isActive
                    ? "bg-accent/20 border-accent/50 text-white shadow-sm"
                    : "bg-white/5 border-transparent hover:bg-white/10 text-white/70 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden mr-2">
                  <MessageSquare size={14} className={isActive ? "text-accent shrink-0" : "text-white/40 shrink-0"} />
                  <div className="truncate text-[13px] font-medium leading-tight">{c.title}</div>
                </div>
                <button
                  onClick={(e) => onDeleteChat(e, c.chatId)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-400 transition-all rounded hover:bg-white/10 shrink-0"
                  title="Delete conversation"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API helpers for chat persistence
// ---------------------------------------------------------------------------

async function fetchChats() {
  try {
    const res = await fetch("/api/chats");
    const data = await res.json();
    return data.success ? data.chats : [];
  } catch {
    return [];
  }
}

async function fetchChatById(chatId) {
  try {
    const res = await fetch(`/api/chats/${chatId}`);
    const data = await res.json();
    return data.success ? data.chat : null;
  } catch {
    return null;
  }
}

async function apiCreateChat(chatId, title) {
  try {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, title, messages: [] }),
    });
    const data = await res.json();
    return data.success ? data.chat : null;
  } catch {
    return null;
  }
}

async function apiUpdateChat(chatId, update) {
  try {
    await fetch(`/api/chats/${chatId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
  } catch {
    // silent fail — next load will reconcile
  }
}

async function apiDeleteChat(chatId) {
  try {
    await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
  } catch {
    // silent fail
  }
}

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

export default function App() {
  const [chatList, setChatList] = useState([]); // summary list from API
  const [activeChat, setActiveChat] = useState(null); // full chat with messages
  const [activeChatId, setActiveChatId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingChats, setLoadingChats] = useState(true);

  const handleNewChat = useCallback(async () => {
    const id = genChatId();
    const serverChat = await apiCreateChat(id, "New Chat");
    const chat = serverChat || {
      chatId: id,
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setChatList((prev) => {
      const exists = prev.some((c) => c.chatId === chat.chatId);
      if (exists) return prev;
      return [{ chatId: chat.chatId, title: chat.title, createdAt: chat.createdAt }, ...prev];
    });
    setActiveChatId(chat.chatId);
    setActiveChat(chat);
    return chat;
  }, []);

  // Load chat list on mount
  useEffect(() => {
    fetchChats().then((chats) => {
      setLoadingChats(false);
      if (chats && chats.length > 0) {
        setChatList(chats);
        setActiveChatId(chats[0].chatId);
      } else {
        handleNewChat();
      }
    });
  }, [handleNewChat]);

  // Load full active chat when activeChatId changes
  useEffect(() => {
    if (!activeChatId) return;
    fetchChatById(activeChatId).then((chat) => {
      if (chat) {
        setActiveChat(chat);
      } else {
        // Fallback local state if chat isn't on server yet
        setActiveChat((prev) => (prev?.chatId === activeChatId ? prev : { chatId: activeChatId, title: "New Chat", messages: [] }));
      }
    });
  }, [activeChatId]);

  const handleDeleteChat = useCallback(
    async (e, chatId) => {
      e.stopPropagation();
      await apiDeleteChat(chatId);
      setChatList((prev) => {
        const updated = prev.filter((c) => c.chatId !== chatId);
        if (activeChatId === chatId) {
          if (updated.length > 0) {
            setActiveChatId(updated[0].chatId);
          } else {
            const newId = genChatId();
            const fallback = { chatId: newId, title: "New Chat", messages: [], createdAt: new Date().toISOString() };
            setActiveChatId(newId);
            setActiveChat(fallback);
            return [fallback];
          }
        }
        return updated;
      });
    },
    [activeChatId]
  );

  // Called by ChatInterface when messages change
  const handleChatUpdate = useCallback(
    async (update) => {
      let targetId = activeChatId;
      if (!targetId) {
        const created = await handleNewChat();
        targetId = created.chatId;
      }
      setActiveChat((prev) => (prev ? { ...prev, ...update } : { chatId: targetId, title: "New Chat", messages: [], ...update }));
      if (update.title) {
        setChatList((prev) => prev.map((c) => (c.chatId === targetId ? { ...c, title: update.title } : c)));
      }
      await apiUpdateChat(targetId, update);
    },
    [activeChatId, handleNewChat]
  );

  return (
    <div className="relative min-h-screen bg-space flex items-center justify-center p-4 md:p-6 overflow-hidden">
      <FullscreenBackground />

      <SidebarHistory
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        chats={chatList}
        activeChatId={activeChatId}
        onSelectChat={(id) => setActiveChatId(id)}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        loading={loadingChats}
      />

      <div
        className={`relative z-10 w-full max-w-2xl transition-all duration-300 ${
          sidebarOpen ? "lg:ml-72" : "ml-0"
        }`}
      >
        <ChatInterface
          activeChat={activeChat}
          onChatUpdate={handleChatUpdate}
          onEnsureActiveChat={handleNewChat}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((s) => !s)}
        />
      </div>
    </div>
  );
}
