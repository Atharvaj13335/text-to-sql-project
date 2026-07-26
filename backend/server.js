import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Anthropic from "@anthropic-ai/sdk";
import { getPool } from "./db.js";
import { SCHEMA_DESCRIPTION, SCHEMA_TABLES } from "./schema.js";
import { validateAndSanitizeSql, SqlValidationError } from "./validateSql.js";
import { getAllChats, getChatById, createChat, updateChat, deleteChat } from "./chatStore.js";

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

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

app.post("/api/ask", async (req, res) => {
  const question = req.body?.question;

  if (!question || typeof question !== "string" || question.length > 500) {
    return res.status(400).json({ success: false, error: "Please provide a question (max 500 characters)." });
  }

  try {
    // 1. Ask Claude to turn the question into SQL, schema-aware.
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: question }],
    });

    const rawText = completion.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

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

    // 3. Execute against SQL Server using the read-only login, with a
    //    request timeout so a runaway query can't hang the pool.
    const pool = await getPool();
    const request = pool.request();
    request.timeout = 8000;
    const result = await request.query(safeSql);

    const columns = result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [];
    const rows = result.recordset.map((row) => Object.values(row).map(String));

    // 4. Log every executed query for auditability (who asked what, and
    //    exactly which SQL actually ran against the database).
    console.log(JSON.stringify({ at: new Date().toISOString(), question, sql: safeSql, tablesUsed }));

    return res.status(200).json({
      success: true,
      explanation: parsed.explanation,
      sql: safeSql,
      tablesUsed,
      columns,
      rows,
      rowCount: result.recordset.length,
    });
  } catch (error) {
    if (error instanceof SqlValidationError) {
      // Log full detail server-side; never leak internals to the client.
      console.warn("Blocked unsafe generated SQL:", error.code, error.message);
      return res.status(422).json({
        success: false,
        error: "The generated query failed safety validation and was not run.",
      });
    }

    console.error("Text-to-SQL error:", error);
    return res.status(500).json({
      success: false,
      error: "Something went wrong generating or running that query.",
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
// Chat persistence routes (MongoDB)
// ---------------------------------------------------------------------------

app.get("/api/chats", async (_req, res) => {
  try {
    const chats = await getAllChats();
    res.json({ success: true, chats });
  } catch (err) {
    console.error("GET /api/chats error:", err);
    res.status(500).json({ success: false, error: "Failed to load chats." });
  }
});

app.post("/api/chats", async (req, res) => {
  try {
    const { chatId, title, messages } = req.body;
    if (!chatId) return res.status(400).json({ success: false, error: "chatId is required." });
    const chat = await createChat({ chatId, title, messages });
    res.status(201).json({ success: true, chat });
  } catch (err) {
    console.error("POST /api/chats error:", err);
    res.status(500).json({ success: false, error: "Failed to create chat." });
  }
});

app.get("/api/chats/:id", async (req, res) => {
  try {
    const chat = await getChatById(req.params.id);
    if (!chat) return res.status(404).json({ success: false, error: "Chat not found." });
    res.json({ success: true, chat });
  } catch (err) {
    console.error("GET /api/chats/:id error:", err);
    res.status(500).json({ success: false, error: "Failed to load chat." });
  }
});

app.put("/api/chats/:id", async (req, res) => {
  try {
    const chat = await updateChat(req.params.id, req.body);
    if (!chat) return res.status(404).json({ success: false, error: "Chat not found." });
    res.json({ success: true, chat });
  } catch (err) {
    console.error("PUT /api/chats/:id error:", err);
    res.status(500).json({ success: false, error: "Failed to update chat." });
  }
});

app.delete("/api/chats/:id", async (req, res) => {
  try {
    const deleted = await deleteChat(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: "Chat not found." });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/chats/:id error:", err);
    res.status(500).json({ success: false, error: "Failed to delete chat." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// Start server with MongoDB connection
// ---------------------------------------------------------------------------

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/text_to_sql";
const PORT = process.env.PORT || 3001;

mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 })
  .then(() => {
    console.log("Connected to MongoDB at", MONGO_URI);
  })
  .catch((err) => {
    console.warn("MongoDB connection unavailable:", err.message);
    console.warn("Falling back to in-memory chat store.");
  })
  .finally(() => {
    app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
  });
