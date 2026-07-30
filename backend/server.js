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

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MAX_ROWS = 200;

const SYSTEM_PROMPT = `You are a SQL Server (T-SQL) query generator for a financial reporting system.

Rules you must always follow:
- Only ever generate a single SELECT statement. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, EXEC, MERGE, or TRUNCATE.
- Only use tables and columns that appear in the schema below. Never invent column or table names.
- Never use SELECT * — always list explicit column names.
- Always add "TOP ${MAX_ROWS}" to the SELECT (or fewer if the user asks for a specific smaller number).
- Use SQL Server syntax (T-SQL), not MySQL/Postgres syntax.
- If the question cannot be answered with the given schema, return {"sql": null, "explanation": "why not"}.

Schema:
${SCHEMA_DESCRIPTION}

Respond with ONLY a JSON object in this exact shape, no prose and no markdown fences outside the JSON:
{
  "explanation": "one or two sentence plain-English summary of what the query returns",
  "sql": "the T-SQL SELECT statement, or null if unanswerable"
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
    const prompt = `You are a financial AI analyst answering a question directly for a user.
User Question: "${question}"
SQL Executed: ${sql}
Columns: ${columns.join(", ")}
Data Rows (sample up to 10):
${JSON.stringify(rows.slice(0, 10))}

Provide a direct, conversational, executive summary (2-3 sentences max) answering the user's question directly based on the data provided above. Mention specific key figures/names where relevant (formatted clearly). Do NOT talk about SQL syntax or database mechanics — talk directly about the business/financial data as a helpful advisor.`;

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    });

    return completion.choices[0]?.message?.content?.trim() || defaultExplanation;
  } catch (err) {
    console.warn("Error generating AI natural language answer:", err.message);
    return defaultExplanation;
  }
}

app.post("/api/ask", async (req, res) => {
  const question = req.body?.question;

  if (!question || typeof question !== "string" || question.length > 500) {
    return res.status(400).json({ success: false, error: "Please provide a question (max 500 characters)." });
  }

  try {
    // 1. Ask AI model (via OpenRouter) to turn the question into SQL, schema-aware.
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: question },
      ],
      response_format: { type: "json_object" },
    });

    const rawText = completion.choices[0]?.message?.content || "";
    const parsed = extractJson(rawText);

    if (!parsed.sql) {
      return res.status(200).json({
        success: false,
        error: parsed.explanation || "I couldn't build a query for that question.",
      });
    }

    // 2. Structural validation — the real gate. Throws SqlValidationError
    //    rather than returning a boolean, so failure and success paths
    //    can't be accidentally confused.
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

    // 5. Log query for auditability
    console.log(JSON.stringify({ at: new Date().toISOString(), question, sql: safeSql, tablesUsed, dbWarning }));

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
    });
  } catch (error) {
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
// Execute custom / edited SQL query
// ---------------------------------------------------------------------------

app.post("/api/execute-sql", async (req, res) => {
  const customSql = req.body?.sql;

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

    console.log(JSON.stringify({ at: new Date().toISOString(), type: "custom-sql", sql: safeSql, tablesUsed }));

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
app.post("/api/auth/signup", async (req, res) => {
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
app.post("/api/auth/signin", async (req, res) => {
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
    const chat = await updateChat(req.params.id, req.body, userEmail);
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
