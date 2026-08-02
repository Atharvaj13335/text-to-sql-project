import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";

import { validateEnvironment } from "./envValidator.js";
import { logger } from "./logger.js";
import { getPool } from "./db.js";
import { SCHEMA_DESCRIPTION, SCHEMA_TABLES } from "./schema.js";
import { validateAndSanitizeSql, SqlValidationError } from "./validateSql.js";
import { getAllChats, getChatById, createChat, updateChat, deleteChat } from "./chatStore.js";
import { registerUser, loginUser, findOrCreateUser, getUserByEmail } from "./userStore.js";
import { getMockQueryData } from "./mockData.js";
import { retrieveRelevantKnowledge, seedKnowledgeBase } from "./knowledgeStore.js";
import { logAuditEntry } from "./auditLogger.js";
import { generateToken, authMiddleware } from "./authMiddleware.js";
import { applyRbacConstraints, isAuthorizedForTable } from "./rbac.js";
import { getCachedQuery, setCachedQuery } from "./queryCache.js";
import { recordFeedback } from "./feedbackStore.js";
import { validateBody, signupSchema, signinSchema, askSchema, executeSqlSchema } from "./validatorMiddleware.js";
import { errorHandler } from "./errorHandler.js";

// Fail fast on startup if environment variables are missing
validateEnvironment();

const app = express();

// Strict CORS Policy
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MAX_ROWS = 200;

// Rate limiting for auth endpoints (10 attempts / 15 mins)
const rateLimitAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many authentication attempts. Please try again after 15 minutes." },
});

// Rate limiting for AI queries (30 requests / 1 min per IP)
const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Rate limit exceeded for query generation. Please wait a minute." },
});

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
    });

    return completion.choices[0]?.message?.content?.trim() || defaultExplanation;
  } catch (err) {
    logger.warn({ err: err.message }, "Secondary natural language generation failed; returning base explanation.");
    return defaultExplanation;
  }
}

// ---------------------------------------------------------------------------
// Text-to-SQL Core Endpoint (Cached, Rate-limited, RBAC Enforced)
// ---------------------------------------------------------------------------

app.post("/api/ask", askLimiter, validateBody(askSchema), async (req, res, next) => {
  const { question, conversationHistory } = req.body;
  const startTime = Date.now();
  const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const userEmail = req.user?.email || "anonymous";

  try {
    // 0. Check LRU Cache
    const cached = getCachedQuery(question);
    if (cached && (!conversationHistory || conversationHistory.length === 0)) {
      logger.info({ question }, "Serving query response from LRU cache.");
      logAuditEntry({
        userEmail,
        ip: clientIp,
        queryType: "TEXT_TO_SQL",
        question,
        sql: cached.sql,
        executionTimeMs: Date.now() - startTime,
        status: "SUCCESS",
        rowCount: cached.rowCount,
      });
      return res.status(200).json({ ...cached, cached: true });
    }

    // 1. RAG Context & Conversation Memory Assembly
    const ragDocs = retrieveRelevantKnowledge(question, 3);
    const ragContextText = ragDocs.map((doc) => `[${doc.category}] ${doc.title}:\n${doc.content}`).join("\n\n");

    const dynamicPrompt = `${SYSTEM_PROMPT}

Retrieved Domain Knowledge & Schema Context (RAG):
${ragContextText}`;

    const messages = [{ role: "system", content: dynamicPrompt }];

    // Incorporate multi-turn conversation memory
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.slice(-4).forEach((turn) => {
        messages.push({ role: turn.role, content: turn.content });
      });
    }
    messages.push({ role: "user", content: question });

    // 2. Ask AI Model
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "openai/gpt-4o-mini",
      messages,
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

      const responsePayload = {
        success: true,
        isConversational: true,
        explanation: parsed.explanation,
        aiAnswer: parsed.explanation,
        sql: null,
        columns: [],
        rows: [],
        rowCount: 0,
        ragDocs: ragDocs.map((d) => ({ title: d.title, category: d.category })),
      };

      setCachedQuery(question, responsePayload);
      return res.status(200).json(responsePayload);
    }

    // 3. Structural SQL Safety Gate
    const { sql: validatedSql, tablesUsed } = validateAndSanitizeSql(parsed.sql, {
      allowedTables: SCHEMA_TABLES,
      maxRows: MAX_ROWS,
    });

    // 4. RBAC Table & Data Restriction Check
    const authCheck = isAuthorizedForTable(req.user, tablesUsed);
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: authCheck.reason });
    }

    const safeSql = applyRbacConstraints(validatedSql, req.user);

    // 5. Query Execution against SQL Server / Smart Mock Fallback
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
      logger.warn({ dbErr: dbErr.message }, "SQL Server unavailable; using smart mock evaluator.");
      dbWarning = "SQL Server (localhost:1433) is currently unreachable. Displaying sample preview data below.";
      const mockResult = getMockQueryData(tablesUsed, safeSql);
      columns = mockResult.columns;
      rows = mockResult.rows;
    }

    // 6. Natural Language Answer Generation
    let aiAnswer = parsed.explanation;
    if (columns.length > 0 && rows.length > 0) {
      aiAnswer = await generateNaturalLanguageAnswer(question, safeSql, columns, rows, parsed.explanation);
    }

    // 7. Audit Log Entry
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

    const responsePayload = {
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
    };

    setCachedQuery(question, responsePayload);
    return res.status(200).json(responsePayload);
  } catch (error) {
    logAuditEntry({
      userEmail,
      ip: clientIp,
      queryType: "TEXT_TO_SQL",
      question,
      sql: null,
      executionTimeMs: Date.now() - startTime,
      status: "FAILURE",
      rowCount: 0,
      error: error.message,
    });
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Execute Custom SQL Query (JWT Protected, RBAC Checked)
// ---------------------------------------------------------------------------

app.post("/api/execute-sql", authMiddleware, validateBody(executeSqlSchema), async (req, res, next) => {
  const { sql: customSql } = req.body;
  const startTime = Date.now();
  const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  const userEmail = req.user?.email || "anonymous";

  try {
    const { sql: validatedSql, tablesUsed } = validateAndSanitizeSql(customSql, {
      allowedTables: SCHEMA_TABLES,
      maxRows: MAX_ROWS,
    });

    const authCheck = isAuthorizedForTable(req.user, tablesUsed);
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: authCheck.reason });
    }

    const safeSql = applyRbacConstraints(validatedSql, req.user);

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
    logAuditEntry({
      userEmail,
      ip: clientIp,
      queryType: "DIRECT_EXECUTE",
      question: "User Custom SQL Execution",
      sql: customSql,
      executionTimeMs: Date.now() - startTime,
      status: "FAILURE",
      rowCount: 0,
      error: error.message,
    });
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Feedback Endpoint
// ---------------------------------------------------------------------------

app.post("/api/feedback", authMiddleware, async (req, res, next) => {
  try {
    const { chatId, question, sql, rating, comment, suggestedSql } = req.body;
    const feedback = await recordFeedback({
      userEmail: req.user.email,
      chatId,
      question,
      sql,
      rating,
      comment,
      suggestedSql,
    });
    res.json({ success: true, feedback });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Auth Routes (JWT Token-Based, Zod Validated, Rate Limited)
// ---------------------------------------------------------------------------

app.post("/api/auth/signup", rateLimitAuth, validateBody(signupSchema), async (req, res, next) => {
  try {
    const user = await registerUser(req.body);
    const token = generateToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    next(err);
  }
});

app.post("/api/auth/signin", rateLimitAuth, validateBody(signinSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await loginUser(email, password);
    const token = generateToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    next(err);
  }
});

app.post("/api/auth/google", async (req, res, next) => {
  try {
    const user = await findOrCreateUser(req.body);
    const token = generateToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    next(err);
  }
});

app.get("/api/auth/profile", authMiddleware, async (req, res, next) => {
  try {
    const user = await getUserByEmail(req.user.email);
    if (!user) return res.status(404).json({ success: false, error: "User not found." });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Chat Persistence Routes (JWT Protected)
// ---------------------------------------------------------------------------

function getUserEmail(req) {
  return req.user?.email || "guest@financial-assistant.com";
}

app.get("/api/chats", authMiddleware, async (req, res, next) => {
  try {
    const email = getUserEmail(req);
    const chats = await getAllChats(email);
    res.json({ success: true, chats });
  } catch (err) {
    next(err);
  }
});

app.get("/api/chats/:id", authMiddleware, async (req, res, next) => {
  try {
    const email = getUserEmail(req);
    const chat = await getChatById(req.params.id, email);
    if (!chat) return res.status(404).json({ success: false, error: "Chat not found." });
    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
});

app.post("/api/chats", authMiddleware, async (req, res, next) => {
  try {
    const email = getUserEmail(req);
    const chat = await createChat(email, req.body);
    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
});

app.put("/api/chats/:id", authMiddleware, async (req, res, next) => {
  try {
    const email = getUserEmail(req);
    const chat = await updateChat(req.params.id, email, req.body);
    if (!chat) return res.status(404).json({ success: false, error: "Chat not found." });
    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/chats/:id", authMiddleware, async (req, res, next) => {
  try {
    const email = getUserEmail(req);
    const deleted = await deleteChat(req.params.id, email);
    if (!deleted) return res.status(404).json({ success: false, error: "Chat not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Centralized Global Express Error Handler Middleware
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Server Initialization
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    logger.info("Connected to MongoDB Atlas successfully.");
    await seedKnowledgeBase();
    app.listen(PORT, () => {
      logger.info(`🚀 Production-Hardened Financial Assistant API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    logger.error({ err: err.message }, "MongoDB connection error. Starting server anyway...");
    app.listen(PORT, () => {
      logger.info(`🚀 Production-Hardened Financial Assistant API running on http://localhost:${PORT}`);
    });
  });
