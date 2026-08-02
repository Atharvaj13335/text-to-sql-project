import { useState, useEffect, useCallback } from "react";
import ChatInterface from "./components/ChatInterface.jsx";
import ParticleField from "./components/ParticleField.jsx";
import AuthModal from "./components/AuthModal.jsx";
import { History, Plus, MessageSquare, Trash2, X, Loader2, LogOut, User } from "lucide-react";

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

function SidebarHistory({ isOpen, onClose, chats, activeChatId, onSelectChat, onNewChat, onDeleteChat, loading, user, onLogout }) {
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

      {/* User Badge */}
      {user && (
        <div className="mt-3 p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-accent/40 bg-accent/20" />
            <div className="truncate">
              <div className="text-[13px] font-medium text-white truncate">{user.name}</div>
              <div className="text-[10px] text-white/50 font-mono truncate">{user.email}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 text-white/40 hover:text-red-400 transition-colors rounded-lg hover:bg-white/10"
            title="Sign Out"
          >
            <LogOut size={15} />
          </button>
        </div>
      )}

      <button
        onClick={onNewChat}
        className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-accent/20 hover:bg-accent/30 border border-accent/40 text-white font-medium text-[13px] transition-all duration-200 shadow-sm hover:shadow-[0_0_20px_-4px_rgba(124,140,255,0.4)]"
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
// API helpers — now use JWT Authorization header
// ---------------------------------------------------------------------------

function authHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function fetchChats(token, onUnauthorized) {
  if (!token) return [];
  try {
    const res = await fetch("/api/chats", { headers: authHeaders(token) });
    if (res.status === 401 && onUnauthorized) {
      onUnauthorized();
      return [];
    }
    const data = await res.json();
    return data.success ? data.chats : [];
  } catch {
    return [];
  }
}

async function fetchChatById(chatId, token, onUnauthorized) {
  if (!chatId || !token) return null;
  try {
    const res = await fetch(`/api/chats/${chatId}`, { headers: authHeaders(token) });
    if (res.status === 401 && onUnauthorized) {
      onUnauthorized();
      return null;
    }
    const data = await res.json();
    return data.success ? data.chat : null;
  } catch {
    return null;
  }
}

async function apiCreateChat(chatId, title, token) {
  if (!token) return null;
  try {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ chatId, title, messages: [] }),
    });
    const data = await res.json();
    return data.success ? data.chat : null;
  } catch {
    return null;
  }
}

async function apiUpdateChat(chatId, update, token) {
  if (!token) return;
  try {
    await fetch(`/api/chats/${chatId}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(update),
    });
  } catch {
    // silent fail
  }
}

async function apiDeleteChat(chatId, token) {
  if (!token) return;
  try {
    await fetch(`/api/chats/${chatId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
  } catch {
    // silent fail
  }
}

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("text_to_sql_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [chatList, setChatList] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [activeChatId, setActiveChatId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingChats, setLoadingChats] = useState(true);

  function handleLogin(userData) {
    setUser(userData);
    localStorage.setItem("text_to_sql_user", JSON.stringify(userData));
  }

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("text_to_sql_user");
    setChatList([]);
    setActiveChat(null);
    setActiveChatId("");
  }, []);

  const handleNewChat = useCallback(async () => {
    if (!user?.token) return null;
    const id = genChatId();
    const chat = {
      chatId: id,
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setChatList((prev) => {
      const exists = prev.some((c) => c.chatId === id);
      if (exists) return prev;
      return [{ chatId: id, title: "New Chat", createdAt: chat.createdAt }, ...prev];
    });
    setActiveChatId(id);
    setActiveChat(chat);
    return chat;
  }, [user]);

  // Load chat list ONCE when user token is present
  useEffect(() => {
    if (!user?.token) {
      setLoadingChats(false);
      return;
    }
    setLoadingChats(true);
    let isMounted = true;
    fetchChats(user.token, handleLogout).then((chats) => {
      if (!isMounted) return;
      setLoadingChats(false);
      if (chats && chats.length > 0) {
        setChatList(chats);
        setActiveChatId(chats[0].chatId);
      } else {
        const id = genChatId();
        const initialChat = { chatId: id, title: "New Chat", messages: [], createdAt: new Date().toISOString() };
        setChatList([initialChat]);
        setActiveChatId(id);
        setActiveChat(initialChat);
      }
    });
    return () => { isMounted = false; };
  }, [user?.token, handleLogout]);

  // Load full active chat when activeChatId changes
  useEffect(() => {
    if (!activeChatId || !user?.token) return;
    let isMounted = true;
    fetchChatById(activeChatId, user.token, handleLogout).then((chat) => {
      if (!isMounted) return;
      if (chat) {
        setActiveChat(chat);
      } else {
        setActiveChat((prev) => (prev?.chatId === activeChatId ? prev : { chatId: activeChatId, title: "New Chat", messages: [] }));
      }
    });
    return () => { isMounted = false; };
  }, [activeChatId, user?.token, handleLogout]);

  const handleDeleteChat = useCallback(
    async (e, chatId) => {
      e.stopPropagation();
      if (!user?.token) return;
      await apiDeleteChat(chatId, user.token);
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
    [activeChatId, user]
  );

  const handleChatUpdate = useCallback(
    async (update) => {
      if (!user?.token) return;
      let targetId = activeChatId;
      if (!targetId) {
        const created = await handleNewChat();
        targetId = created.chatId;
      }
      setActiveChat((prev) => (prev ? { ...prev, ...update } : { chatId: targetId, title: "New Chat", messages: [], ...update }));
      if (update.title) {
        setChatList((prev) => prev.map((c) => (c.chatId === targetId ? { ...c, title: update.title } : c)));
      }
      await apiUpdateChat(targetId, update, user.token);
    },
    [activeChatId, handleNewChat, user]
  );

  return (
    <div className="relative min-h-screen bg-space flex items-center justify-center p-4 md:p-6 overflow-hidden">
      <FullscreenBackground />

      {!user ? (
        <AuthModal onLogin={handleLogin} />
      ) : (
        <>
          <SidebarHistory
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            chats={chatList}
            activeChatId={activeChatId}
            onSelectChat={(id) => setActiveChatId(id)}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
            loading={loadingChats}
            user={user}
            onLogout={handleLogout}
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
              user={user}
            />
          </div>
        </>
      )}
    </div>
  );
}
