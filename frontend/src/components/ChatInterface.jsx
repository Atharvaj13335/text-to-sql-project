import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  ChevronRight,
  BarChart3,
  Table2,
  Sparkles,
  X,
  PanelLeft,
  Plus,
  Trash2,
  History,
  MessageSquare,
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ParticleField from "./ParticleField.jsx";

// ---------------------------------------------------------------------------
// Calls the Node backend's /api/ask route. In dev, vite.config.js proxies
// /api to http://localhost:3001.
// ---------------------------------------------------------------------------
async function askBackend(question, token) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch("/api/ask", {
      method: "POST",
      headers,
      body: JSON.stringify({ question }),
    });

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Backend server is unavailable (port 3001). Please ensure the backend server is running.");
    }

    const data = await res.json();
    if (!res.ok || (data.success === false && !data.isConversational)) {
      throw new Error(data.error || "Request failed.");
    }
    return data;
  } catch (err) {
    if (err.message.includes("Unexpected token") || err.message.includes("JSON")) {
      throw new Error("Backend server is unavailable (port 3001). Please ensure the backend server is running.");
    }
    throw err;
  }
}

// --- Chart eligibility -------------------------------------------------

function parseNumeric(value) {
  const cleaned = String(value).replace(/[%,$]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
function isDateLike(value) {
  return /^\d{4}-\d{2}-\d{2}/.test(String(value));
}
function detectChartShape(columns, rows) {
  if (!rows || rows.length < 2 || rows.length > 50) return null;
  const colTypes = columns.map((_, colIdx) => {
    const values = rows.map((r) => r[colIdx]);
    if (values.every((v) => parseNumeric(v) !== null)) return "numeric";
    if (values.every(isDateLike)) return "date";
    return "label";
  });
  const numericIdx = colTypes.indexOf("numeric");
  const labelIdx = colTypes.findIndex((t) => t === "label" || t === "date");
  if (numericIdx === -1 || labelIdx === -1) return null;
  return {
    type: colTypes[labelIdx] === "date" ? "line" : "bar",
    data: rows.map((r) => ({ label: r[labelIdx], value: parseNumeric(r[numericIdx]) })),
    valueLabel: columns[numericIdx],
  };
}

// --- Animated background: starfield + slow-drifting nebula glow ---------
// Three low-opacity hues (violet / gold / aqua) drifting independently, so
// this doesn't read as "one flat neon accent on black" — the most common
// AI-generated dark-mode default.

function Starfield() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-16 -left-10 w-72 h-72 rounded-full bg-accent/20 blur-3xl animate-drift" />
      <div
        className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-gold/10 blur-3xl animate-drift"
        style={{ animationDelay: "4s", animationDuration: "24s" }}
      />
      <div
        className="absolute top-1/3 right-1/4 w-56 h-56 rounded-full bg-aqua/10 blur-3xl animate-drift"
        style={{ animationDelay: "8s", animationDuration: "27s" }}
      />
      <ParticleField density={90} />
    </div>
  );
}

// --- Status beacon — the signature element -------------------------------
// Every result shows whether its query passed structural validation before
// running. A HUD-style beacon fits this theme better than a paper stamp:
// a soft pulsing glow reads as "live and confirmed," a steady ring reads
// as "held."

function StatusBeacon({ ok }) {
  if (ok) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-glow-pulse" />
        <span className="text-[10px] uppercase tracking-wider text-accent font-mono">Verified · read-only</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full border border-gold" />
      <span className="text-[10px] uppercase tracking-wider text-gold font-mono">Blocked · not executed</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calls backend /api/execute-sql route to validate and run custom SQL.
// ---------------------------------------------------------------------------
async function executeSqlBackend(sql) {
  const res = await fetch("/api/execute-sql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || "Failed to execute query.");
  }
  return data; // { success: true, explanation, sql, columns, rows, rowCount }
}

function SqlDisclosure({ sql, onSaveSql, token }) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSql, setEditedSql] = useState(sql);
  const [running, setRunning] = useState(false);
  const [execError, setExecError] = useState("");

  useEffect(() => {
    setEditedSql(sql);
  }, [sql]);

  async function handleRunCustomSql() {
    if (!editedSql.trim() || running) return;
    setRunning(true);
    setExecError("");
    try {
      const result = await executeSqlBackend(editedSql, token);
      if (onSaveSql) {
        onSaveSql(result);
      }
      setIsEditing(false);
    } catch (err) {
      setExecError(err.message || "Failed to run custom query.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-3 border-t border-white/10 pt-2.5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-white/40 hover:text-white/80 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 rounded"
        >
          <span className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
            <ChevronRight size={12} />
          </span>
          {open ? "Hide query" : "View query"}
        </button>

        {!isEditing && (
          <button
            onClick={() => {
              setOpen(true);
              setIsEditing(true);
              setExecError("");
            }}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 hover:bg-accent/20 border border-white/10 hover:border-accent/40 font-mono text-[10px] uppercase tracking-wider text-white/60 hover:text-white transition-all duration-200"
          >
            <Sparkles size={11} className="text-accent" /> Edit SQL
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2.5">
          {isEditing ? (
            <div className="space-y-2 animate-slide-up-pop">
              <div className="flex items-center justify-between text-[11px] font-mono text-accent">
                <span>Edit T-SQL Query:</span>
                <span className="text-[10px] text-white/40">Read-Only SQL Server Sandbox</span>
              </div>
              <textarea
                value={editedSql}
                onChange={(e) => setEditedSql(e.target.value)}
                rows={4}
                className="w-full bg-black/80 border border-accent/50 text-emerald-300 font-mono text-[12px] rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-accent/60 leading-relaxed resize-y"
              />
              {execError && (
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-[12px] font-mono leading-tight">
                  {execError}
                </div>
              )}
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedSql(sql);
                    setExecError("");
                  }}
                  disabled={running}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[12px] text-white/70 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRunCustomSql}
                  disabled={running || !editedSql.trim()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent hover:brightness-110 text-white text-[12px] font-medium transition-all shadow-md active:scale-95 disabled:opacity-40"
                >
                  {running ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Executing…
                    </>
                  ) : (
                    <>
                      <Send size={12} /> Execute Query
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <pre className="bg-black/50 border border-white/10 text-white/80 rounded-lg px-3 py-2.5 text-[12px] font-mono overflow-x-auto leading-relaxed">
              {sql}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ResultTable({ columns, rows }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={c}
                className={`font-mono text-[10px] uppercase tracking-wider text-white/40 font-medium border-b border-white/10 pb-1.5 whitespace-nowrap ${
                  i === 0 ? "text-left pr-4" : "text-right pl-4"
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-white/5 last:border-0">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`py-1.5 whitespace-nowrap text-white/85 ${
                    ci === 0 ? "text-left pr-4" : "text-right pl-4 font-mono tabular-nums"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultChart({ shape }) {
  const Chart = shape.type === "line" ? LineChart : BarChart;
  return (
    <div className="mt-3" style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={shape.data} margin={{ top: 6, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="2 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fontFamily: "ui-monospace, monospace", fill: "rgba(255,255,255,0.5)" }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={48}
            axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fontFamily: "ui-monospace, monospace", fill: "rgba(255,255,255,0.5)" }}
            width={38}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(v) => [v, shape.valueLabel]}
            contentStyle={{
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              borderRadius: 8,
              background: "#0F1220",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
            }}
          />
          {shape.type === "line" ? (
            <Line type="monotone" dataKey="value" stroke="#7C8CFF" strokeWidth={2} dot={{ r: 3, fill: "#7C8CFF" }} />
          ) : (
            <Bar dataKey="value" fill="#7C8CFF" radius={[3, 3, 0, 0]} />
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

function ResultView({ columns, rows }) {
  const shape = detectChartShape(columns, rows);
  const [view, setView] = useState(shape ? "chart" : "table");

  return (
    <div>
      {shape && (
        <div className="mt-3 inline-flex bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <button
            onClick={() => setView("chart")}
            className={`flex items-center gap-1 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors duration-200 focus-visible:outline-none ${
              view === "chart" ? "bg-accent text-white" : "text-white/40 hover:text-white/80"
            }`}
          >
            <BarChart3 size={11} /> Chart
          </button>
          <button
            onClick={() => setView("table")}
            className={`flex items-center gap-1 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider border-l border-white/10 transition-colors duration-200 focus-visible:outline-none ${
              view === "table" ? "bg-accent text-white" : "text-white/40 hover:text-white/80"
            }`}
          >
            <Table2 size={11} /> Table
          </button>
        </div>
      )}
      {view === "chart" && shape ? <ResultChart shape={shape} /> : <ResultTable columns={columns} rows={rows} />}
    </div>
  );
}

function QuickQueriesModal({ isOpen, onClose, onSelectQuery }) {
  if (!isOpen) return null;

  const sampleQueries = [
    { label: "Top 5 Composites", query: "Show top 5 composites by YTD return" },
    { label: "Asset Class Allocation", query: "Show total AUM breakdown by asset class" },
    { label: "Recent Performance", query: "List monthly returns for large cap equity" },
    { label: "Risk Metrics", query: "Show portfolio Sharpe ratio and volatility metrics" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-backdrop-fade">
      <div className="relative w-full max-w-md bg-panel/95 border border-white/15 rounded-2xl p-5 shadow-2xl animate-pop-up">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2 text-white font-medium text-[15px]">
            <Sparkles size={16} className="text-accent" />
            <span>Quick Query Suggestions</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-[13px] text-white/60 mb-4">
          Select a sample query to populate and submit in your financial data assistant:
        </p>

        <div className="space-y-2">
          {sampleQueries.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                onSelectQuery(q.query);
                onClose();
              }}
              className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10
                         hover:bg-accent/20 hover:border-accent/50 transition-all duration-200
                         group flex items-center justify-between"
            >
              <div>
                <div className="text-[13px] font-medium text-white group-hover:text-accent transition-colors">
                  {q.label}
                </div>
                <div className="text-[11px] text-white/50 font-mono mt-0.5">{q.query}</div>
              </div>
              <ChevronRight size={14} className="text-white/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Message({ role, content, onSaveSql, token }) {
  if (role === "user") {
    return (
      <div className="flex justify-end animate-slide-up-pop">
        <div className="max-w-[80%] bg-accent/20 border border-accent/40 text-white rounded-xl px-3.5 py-2 text-[14px] backdrop-blur-sm shadow-md">
          {content}
        </div>
      </div>
    );
  }

  const isError = Boolean(content.error && !content.isConversational);
  const isPlain = typeof content === "string";

  return (
    <div className="flex justify-start animate-slide-up-pop">
      <div
        className="max-w-[92%] w-full bg-panel/85 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3
                   transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5
                   hover:shadow-[0_8px_30px_-8px_rgba(124,140,255,0.25)]"
      >
        {isPlain ? (
          <p className="text-[14px] text-white/70">{content}</p>
        ) : isError ? (
          <>
            <StatusBeacon ok={false} />
            <p className="text-[13.5px] text-white/70 mt-2">{content.error}</p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <StatusBeacon ok={true} />
              {!content.isConversational && content.ragDocs?.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                  <span>📚 RAG Context:</span>
                  <span className="text-white/80">{content.ragDocs.map((d) => d.title).join(" • ")}</span>
                </div>
              )}
            </div>
            {content.aiAnswer ? (
              <div className={`mt-2.5 p-3.5 rounded-xl border text-white shadow-sm ${content.isConversational ? "bg-white/5 border-white/10" : "bg-accent/15 border-accent/35"}`}>
                {!content.isConversational && (
                  <div className="flex items-center gap-1.5 text-accent text-[11px] font-mono uppercase tracking-wider font-semibold mb-1.5">
                    <Sparkles size={13} className="text-accent animate-pulse" />
                    <span>AI Insights</span>
                  </div>
                )}
                <p className="text-[14px] text-white/95 leading-relaxed">{content.aiAnswer}</p>
              </div>
            ) : (
              <p className="text-[14px] text-white/90 mt-2 leading-relaxed">{content.explanation}</p>
            )}

            {!content.isConversational && content.dbWarning && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11.5px] font-mono leading-snug">
                ⚠️ {content.dbWarning}
              </div>
            )}

            {!content.isConversational && content.columns?.length > 0 && <ResultView columns={content.columns} rows={content.rows} />}
            {!content.isConversational && content.sql && <SqlDisclosure sql={content.sql} onSaveSql={onSaveSql} token={token} />}
          </>
        )}
      </div>
    </div>
  );
}

export default function ChatInterface({ activeChat, onChatUpdate, onEnsureActiveChat, sidebarOpen, onToggleSidebar, user }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const bottomRef = useRef(null);

  const token = user?.token;
  const messages = activeChat ? activeChat.messages : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleUpdateMessage(msgIndex, newResult) {
    const updatedMessages = messages.map((m, idx) => {
      if (idx !== msgIndex) return m;
      return {
        ...m,
        content: newResult,
      };
    });
    onChatUpdate({ messages: updatedMessages });
  }

  async function handleSend(customText) {
    const question = (customText || input).trim();
    if (!question || loading) return;

    let chatToUse = activeChat;
    if (!chatToUse && onEnsureActiveChat) {
      chatToUse = await onEnsureActiveChat();
    }
    if (!chatToUse) return;

    const currentMessages = chatToUse.messages || [];
    const userMsg = { role: "user", content: question };
    const updatedMessages = [...currentMessages, userMsg];

    // Auto-generate title from first user question
    const newTitle =
      chatToUse.title === "New Chat"
        ? question.length > 30
          ? question.slice(0, 30) + "…"
          : question
        : chatToUse.title;

    onChatUpdate({ title: newTitle, messages: updatedMessages });

    setInput("");
    setLoading(true);

    try {
      const result = await askBackend(question, token);
      onChatUpdate({ messages: [...updatedMessages, { role: "assistant", content: result }] });
    } catch (err) {
      onChatUpdate({ messages: [...updatedMessages, { role: "assistant", content: { error: err.message } }] });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto h-[640px] rounded-2xl overflow-hidden border border-white/10 bg-panel/75 backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(124,140,255,0.25)] animate-slide-up-pop-delayed flex">
      <QuickQueriesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelectQuery={(q) => {
          setInput(q);
        }}
      />

      {/* Main Container */}
      <div className="relative z-10 flex flex-col h-full w-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSidebar}
              className={`p-1.5 rounded-lg border transition-all mr-1 ${
                sidebarOpen
                  ? "bg-accent/20 border-accent/50 text-white"
                  : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white"
              }`}
              title={sidebarOpen ? "Hide Past Chats" : "Show Past Chats"}
            >
              <PanelLeft size={16} />
            </button>
            <span className="text-[13px] uppercase tracking-widest text-white/90 font-medium truncate max-w-[200px] sm:max-w-xs">
              {activeChat?.title || "Financial Data Assistant"}
            </span>
            <button
              onClick={() => setModalOpen(true)}
              className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 hover:bg-accent/30 border border-accent/40 text-[10px] font-mono uppercase tracking-wider text-white transition-all duration-200"
            >
              <Sparkles size={11} className="text-accent" /> Quick Queries
            </button>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-glow-pulse" />
            Connected · read-only
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full text-center animate-slide-up-pop">
              <div className="w-12 h-12 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center mb-4">
                <Sparkles size={20} className="text-accent" />
              </div>
              <p className="text-white/70 text-[15px] font-medium">What would you like to know?</p>
              <p className="text-white/40 text-[13px] mt-1 max-w-xs">
                Ask about financial data, composites, or performance metrics.
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <Message
                key={i}
                role={m.role}
                content={m.content}
                onSaveSql={(newResult) => handleUpdateMessage(i, newResult)}
                token={token}
              />
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-panel/85 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2.5 flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-white/50">
                <Loader2 size={13} className="animate-spin text-accent" /> Generating query
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-white/10 bg-black/25 backdrop-blur-md flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about performance or composites…"
            rows={1}
            className="flex-1 resize-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[14px] text-white
                       placeholder-white/30 transition-all duration-200
                       focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="bg-accent text-white rounded-lg p-2.5 transition-all duration-200
                       hover:shadow-[0_0_20px_-2px_rgba(124,140,255,0.6)] hover:brightness-110
                       active:scale-95 disabled:opacity-20 disabled:hover:shadow-none
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

