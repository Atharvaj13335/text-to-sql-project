import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import OpenAI from "openai";
import { getPool } from "./db.js";
import { SCHEMA_DESCRIPTION, SCHEMA_TABLES } from "./schema.js";
import { validateAndSanitizeSql, SqlValidationError } from "./validateSql.js";
import { getAllChats, getChatById, createChat, updateChat, deleteChat } from "./chatStore.js";
import { registerUser, loginUser, findOrCreateUser, getUserByEmail } from "./userStore.js";
import { getMockQueryData } from "./mockData.js";
import { retrieveRelevantKnowledge } from "./knowledgeStore.js";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MAX_ROWS = 200;

const SYSTEM_PROMPT = `You are an intelligent Financial Data AI Assistant capable of answering financial queries using SQL Server (T-SQL) as well as engaging in natural conversation.

Rules you must always follow:
- If the user greeting you (e.g. 'hi', 'hello', 'hey', 'hii') or asking a general non-database question, set "sql": null and provide a friendly, helpful conversational response in "explanation".
- Only ever generate a single SELECT statement when querying data. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, EXEC, MERGE, or TRUNCATE.
- Only use tables and columns that appear in the schema below. Never invent column or table names.
- Never use SELECT * — always list explicit column names.
- Always add "TOP ${MAX_ROWS}" to the SELECT (or fewer if the user asks for a specific smaller number).
- Use SQL Server syntax (T-SQL), not MySQL/Postgres syntax.
- If the question cannot be answered with the given schema, return {"sql": null, "explanation": "friendly explanation of what financial performance data is available"}.

Schema:
${SCHEMA_DESCRIPTION}

Respond with ONLY a JSON object in this exact shape, no prose and no markdown fences outside the JSON:
{
  "explanation": "friendly conversational response OR plain-English summary of what the query returns",
  "sql": "the T-SQL SELECT statement, or null if greeting/general conversation/unanswerable"
}`;

function extractJson(rawText) {
  const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Model response was not valid JSON.");
  }
}

async function generateNaturalLanguageAnswer(question, sql, columns, rows, defaultExplanation) {
  if (!rows || rows.length === 0) {
    return defaultExplanation || "No matching data records were found for your query.";
  }

  try {
    const prompt = `You are an expert financial AI analyst. Analyze the following data returned from a query and answer the user's question directly with key analytical insights.

User Question: "${question}"
SQL Executed: ${sql}
Columns: ${columns.join(", ")}
Data Rows:
${JSON.stringify(rows.slice(0, 15))}

Provide a well-formatted analysis with:
1. **Executive Summary**: Direct 1-2 sentence answer to the user's question.
2. **Key Data Highlights**: 2-3 bullet points calling out specific top values, totals, averages, or significant patterns in the dataset.
3. **Analyst Takeaway**: 1 brief actionable observation based on the figures.

Use plain text formatting with bullet points and bold highlights. Keep it concise, professional, and focused purely on the financial data. Do NOT mention SQL syntax or table structure.`;

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
    });

    return completion.choices[0]?.message?.content?.trim() || defaultExplanation;
  } catch (err) {
    console.warn("Error generating AI natural language answer:", err.message);
    return defaultExplanation;
  }
}

import { logAuditEntry } from "./auditLogger.js";
import rateLimit from "express-rate-limit";

// Rate limiting for auth endpoints — 10 attempts per 15 minutes per IP
const rateLimitAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many authentication attempts. Please try again after 15 minutes." },
});

app.post("/api/ask", async (req, res) => {
  const question = req.body?.question;
  const startTime = Date.now();
  const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const userEmail = req.user?.email || "anonymous";

  if (!question || typeof question !== "string" || question.length > 500) {
    return res.status(400).json({ success: false, error: "Please provide a question (max 500 characters)." });
  }

  try {
    // 1. RAG Knowledge Retrieval — retrieve relevant domain/schema context matching the question
    const ragDocs = retrieveRelevantKnowledge(question, 3);
    const ragContextText = ragDocs.map((doc) => `[${doc.category}] ${doc.title}:\n${doc.content}`).join("\n\n");

    const dynamicPrompt = `${SYSTEM_PROMPT}

Retrieved Domain Knowledge & Schema Context (RAG):
${ragContextText}`;

    // 2. Ask AI model (via OpenRouter) with RAG context injected.
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: dynamicPrompt },
        { role: "user", content: question },
      ],
      response_format: { type: "json_object" },
    });

    const rawText = completion.choices[0]?.message?.content || "";
    const parsed = extractJson(rawText);

    if (!parsed.sql) {
      logAuditEntry({
        userEmail,
        ip: clientIp,
        queryType: "CONVERSATIONAL",
        question,
        sql: null,
        executionTimeMs: Date.now() - startTime,
        status: "SUCCESS",
        rowCount: 0,
      });

      return res.status(200).json({
        success: true,
        isConversational: true,
        explanation: parsed.explanation,
        aiAnswer: parsed.explanation,
        sql: null,
        columns: [],
        rows: [],
        rowCount: 0,
        ragDocs: ragDocs.map((d) => ({ title: d.title, category: d.category })),
      });
    }

    // 2. Structural validation — the real gate. Throws SqlValidationError
    const { sql: safeSql, tablesUsed } = validateAndSanitizeSql(parsed.sql, {
      allowedTables: SCHEMA_TABLES,
      maxRows: MAX_ROWS,
    });

    // 3. Attempt execution against SQL Server
    let columns = [];
    let rows = [];
    let dbWarning = null;

    try {
      const pool = await getPool();
      const request = pool.request();
      request.timeout = 8000;
      const result = await request.query(safeSql);

      columns = result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [];
      rows = result.recordset.map((row) => Object.values(row).map(String));
    } catch (dbErr) {
      console.warn("SQL Server unavailable or unreachable:", dbErr.message);
      dbWarning = "SQL Server (localhost:1433) is currently unreachable. Displaying sample preview data below.";
      const mockResult = getMockQueryData(tablesUsed, safeSql);
      columns = mockResult.columns;
      rows = mockResult.rows;
    }

    // 4. Generate direct natural language AI answer based on the data results
    let aiAnswer = parsed.explanation;
    if (columns.length > 0 && rows.length > 0) {
      aiAnswer = await generateNaturalLanguageAnswer(question, safeSql, columns, rows, parsed.explanation);
    }

    // 5. Log query for auditability into audit.jsonl
    logAuditEntry({
      userEmail,
      ip: clientIp,
      queryType: "TEXT_TO_SQL",
      question,
      sql: safeSql,
      executionTimeMs: Date.now() - startTime,
      status: "SUCCESS",
      rowCount: rows.length,
    });

    return res.status(200).json({
      success: true,
      explanation: parsed.explanation,
      aiAnswer,
      sql: safeSql,
      tablesUsed,
      columns,
      rows,
      rowCount: rows.length,
      dbWarning,
      ragDocs: ragDocs.map((d) => ({ title: d.title, category: d.category })),
    });
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    logAuditEntry({
      userEmail,
      ip: clientIp,
      queryType: "TEXT_TO_SQL",
      question,
      sql: null,
      executionTimeMs,
      status: "FAILURE",
      rowCount: 0,
      error: error.message,
    });

    if (error instanceof SqlValidationError) {
      console.warn("Blocked unsafe generated SQL:", error.code, error.message);
      return res.status(422).json({
        success: false,
        error: "The generated query failed safety validation and was not run.",
      });
    }

    if (error?.status === 401 || error?.message?.includes("API key")) {
      console.warn("OpenAI / OpenRouter API key error:", error.message);
      return res.status(401).json({
        success: false,
        error: "OpenRouter API Key is missing or invalid. Please update OPENROUTER_API_KEY in backend/.env with your valid key.",
      });
    }

    console.error("Text-to-SQL error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong generating or running that query.",
    });
  }
});

// ---------------------------------------------------------------------------
// Execute custom / edited SQL query (JWT-Protected)
// ---------------------------------------------------------------------------

app.post("/api/execute-sql", authMiddleware, async (req, res) => {
  const customSql = req.body?.sql;
  const startTime = Date.now();
  const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const userEmail = req.user?.email || "anonymous";

  if (!customSql || typeof customSql !== "string" || customSql.length > 2000) {
    return res.status(400).json({ success: false, error: "Please provide a valid SQL query." });
  }

  try {
    const { sql: safeSql, tablesUsed } = validateAndSanitizeSql(customSql, {
      allowedTables: SCHEMA_TABLES,
      maxRows: MAX_ROWS,
    });

    const pool = await getPool();
    const request = pool.request();
    request.timeout = 8000;
    const result = await request.query(safeSql);

    const columns = result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [];
    const rows = result.recordset.map((row) => Object.values(row).map(String));

    logAuditEntry({
      userEmail,
      ip: clientIp,
      queryType: "DIRECT_EXECUTE",
      question: "User Custom SQL Execution",
      sql: safeSql,
      executionTimeMs: Date.now() - startTime,
      status: "SUCCESS",
      rowCount: result.recordset.length,
    });

    return res.status(200).json({
      success: true,
      explanation: "Executed custom modified query",
      sql: safeSql,
      tablesUsed,
      columns,
      rows,
      rowCount: result.recordset.length,
    });
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    logAuditEntry({
      userEmail,
      ip: clientIp,
      queryType: "DIRECT_EXECUTE",
      question: "User Custom SQL Execution",
      sql: customSql,
      executionTimeMs,
      status: "FAILURE",
      rowCount: 0,
      error: error.message,
    });

    if (error instanceof SqlValidationError) {
      console.warn("Blocked unsafe custom SQL:", error.code, error.message);
      return res.status(422).json({
        success: false,
        error: `SQL Validation Error: ${error.message}`,
      });
    }

    console.error("Custom SQL execution error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to execute modified SQL query.",
    });
  }
});

// ---------------------------------------------------------------------------
// Auth routes (JWT Token-Based)
// ---------------------------------------------------------------------------

import { generateToken, authMiddleware } from "./authMiddleware.js";

// Sign Up — rejects if account already exists
app.post("/api/auth/signup", rateLimitAuth, async (req, res) => {
  try {
    const { email, name, password, mobile, provider, avatar } = req.body;
    const user = await registerUser({ email, name, password, mobile, provider, avatar });
    const token = generateToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || "Registration failed.";
    console.error("POST /api/auth/signup error:", message);
    res.status(status).json({ success: false, error: message });
  }
});

// Sign In — rejects if account doesn't exist
app.post("/api/auth/signin", rateLimitAuth, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await loginUser(email, password);
    const token = generateToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || "Authentication failed.";
    console.error("POST /api/auth/signin error:", message);
    res.status(status).json({ success: false, error: message });
  }
});

// Google / OTP sign-in — find or create
app.post("/api/auth/google", async (req, res) => {
  try {
    const { email, name, mobile, provider, avatar } = req.body;
    const user = await findOrCreateUser({ email, name, mobile, provider, avatar });
    const token = generateToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || "Authentication failed.";
    console.error("POST /api/auth/google error:", message);
    res.status(status).json({ success: false, error: message });
  }
});

// Get user profile (protected)
app.get("/api/auth/profile", authMiddleware, async (req, res) => {
  try {
    const user = await getUserByEmail(req.user.email);
    if (!user) return res.status(404).json({ success: false, error: "User not found." });
    res.json({ success: true, user });
  } catch (err) {
    console.error("GET /api/auth/profile error:", err);
    res.status(500).json({ success: false, error: "Failed to load profile." });
  }
});

// ---------------------------------------------------------------------------
// Chat persistence routes (JWT-protected)
// ---------------------------------------------------------------------------

function getUserEmail(req) {
  return req.user?.email || "guest@financial-assistant.com";
}

app.get("/api/chats", authMiddleware, async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    const chats = await getAllChats(userEmail);
    res.json({ success: true, chats });
  } catch (err) {
    console.error("GET /api/chats error:", err);
    res.status(500).json({ success: false, error: "Failed to load chats." });
  }
});

app.get("/api/chats/:id", authMiddleware, async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    const chat = await getChatById(req.params.id, userEmail);
    if (!chat) return res.status(404).json({ success: false, error: "Chat not found." });
    res.json({ success: true, chat });
  } catch (err) {
    console.error("GET /api/chats/:id error:", err);
    res.status(500).json({ success: false, error: "Failed to load chat." });
  }
});

app.post("/api/chats", authMiddleware, async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    const chat = await createChat({ ...req.body, userEmail });
    res.status(201).json({ success: true, chat });
  } catch (err) {
    console.error("POST /api/chats error:", err);
    res.status(500).json({ success: false, error: "Failed to create chat." });
  }
});

app.put("/api/chats/:id", authMiddleware, async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    const chat = await updateChat(req.params.id, userEmail, req.body);
    if (!chat) return res.status(404).json({ success: false, error: "Chat not found." });
    res.json({ success: true, chat });
  } catch (err) {
    console.error("PUT /api/chats/:id error:", err);
    res.status(500).json({ success: false, error: "Failed to update chat." });
  }
});

app.delete("/api/chats/:id", authMiddleware, async (req, res) => {
  try {
    const userEmail = getUserEmail(req);
    const deleted = await deleteChat(req.params.id, userEmail);
    if (!deleted) return res.status(404).json({ success: false, error: "Chat not found." });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/chats/:id error:", err);
    res.status(500).json({ success: false, error: "Failed to delete chat." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// Start server with MongoDB connection (Auto-spawns embedded MongoMemoryServer if needed)
// ---------------------------------------------------------------------------

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/text_to_sql";
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2000 });
    console.log("Connected to MongoDB at", MONGO_URI);
  } catch {
    console.warn("Local MongoDB instance not detected on 127.0.0.1:27017.");
    console.log("Starting embedded local MongoDB server...");
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongod = await MongoMemoryServer.create();
      const embeddedUri = mongod.getUri();
      await mongoose.connect(embeddedUri);
      console.log("SUCCESS: Connected to Embedded Local MongoDB at", embeddedUri);
    } catch (err) {
      console.warn("Embedded MongoDB failed, falling back to in-memory store:", err.message);
    }
  } finally {
    const server = app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.log(`\n======================================================`);
        console.log(`Backend server is ALREADY running on http://localhost:${PORT}`);
        console.log(`======================================================\n`);
      } else {
        console.error("Server error:", err);
      }
    });
  }
}

startServer();
