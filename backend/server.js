import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";

import { validateEnvironment } from "./src/config/envValidator.js";
import { logger } from "./src/utils/logger.js";
import { getPool } from "./src/config/db.js";
import { SCHEMA_DESCRIPTION, SCHEMA_TABLES } from "./src/config/schema.js";
import { validateAndSanitizeSql, SqlValidationError } from "./src/security/validateSql.js";
import { getAllChats, getChatById, createChat, updateChat, deleteChat } from "./src/services/chatStore.js";
import { registerUser, loginUser, findOrCreateUser, getUserByEmail } from "./src/services/userStore.js";
import { getMockQueryData } from "./src/services/mockData.js";
import { retrieveRelevantKnowledge, seedKnowledgeBase } from "./src/services/knowledgeStore.js";
import { logAuditEntry } from "./src/security/auditLogger.js";
import { generateToken, authMiddleware } from "./src/middleware/authMiddleware.js";
import { applyRbacConstraints, isAuthorizedForTable } from "./src/security/rbac.js";
import { getCachedQuery, setCachedQuery } from "./src/services/queryCache.js";
import { recordFeedback } from "./src/services/feedbackStore.js";
import { validateBody, signupSchema, signinSchema, askSchema, executeSqlSchema } from "./src/middleware/validatorMiddleware.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import { handleSseConnect, handleSseMessage } from "./src/mcp/mcpSse.js";

// Fail fast on startup if environment variables are missing
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3001;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AI_MODEL = process.env.AI_MODEL || "openai/gpt-4o-mini";
const MONGO_URI = process.env.MONGO_URI;

// Restrict CORS to authorized frontend origin in production
const allowedOrigins = [process.env.FRONTEND_URL || "http://localhost:5173", "http://127.0.0.1:5173"];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin }, "Blocked CORS request from unauthorized origin");
        callback(new Error("CORS Policy Violation: Access from this origin is prohibited."));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Sliding-window Rate Limiters
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, error: "Too many login attempts. Please try again after 1 minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: "Rate limit exceeded. Maximum 30 queries per minute permitted." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper function to synthesize direct, data-backed AI answers from SQL query results
function generateDataInsight(question, columns, rows, fallbackExplanation) {
  if (!rows || rows.length === 0) {
    return "No matching financial records were found for your query.";
  }

  // Exclude ID columns (e.g. AccountID, CompositeID) when finding descriptive name column
  let nameIdx = columns.findIndex((c) => /name/i.test(c) && !/id$/i.test(c));
  if (nameIdx === -1) {
    nameIdx = columns.findIndex((c) => !/id$/i.test(c) && !/date$/i.test(c));
  }
  if (nameIdx === -1) nameIdx = 0;

  // Find numeric metric column (e.g. MarketValue, YTDReturn, AUM, Count), ignoring IDs
  let valIdx = columns.findIndex((c) => /return|marketvalue|value|aum|count|total/i.test(c) && !/id$/i.test(c));
  if (valIdx === -1) {
    valIdx = columns.findIndex((c, i) => i !== nameIdx && !/id$/i.test(c) && !/date$/i.test(c));
  }

  if (nameIdx !== -1 && valIdx !== -1 && nameIdx !== valIdx) {
    const topItem = rows[0];
    const topName = topItem[nameIdx];
    const rawVal = topItem[valIdx];

    const isReturn = /return/i.test(columns[valIdx]);
    const isCurrency = /marketvalue|value|aum|revenue|total/i.test(columns[valIdx]);
    const numVal = Number(rawVal);
    const formattedVal = isReturn
      ? `${rawVal}%`
      : isCurrency && !isNaN(numVal)
      ? `$${numVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : rawVal;

    if (rows.length === 1) {
      return `Based on the latest financial data, **${topName}** stands at **${formattedVal}**.`;
    }

    const secondItem = rows[1];
    const secondName = secondItem[nameIdx];
    const secondRaw = secondItem[valIdx];
    const numSecond = Number(secondRaw);
    const formattedSecond = isReturn
      ? `${secondRaw}%`
      : isCurrency && !isNaN(numSecond)
      ? `$${numSecond.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : secondRaw;

    return `Retrieved ${rows.length} records. **${topName}** leads with **${formattedVal}**, followed by **${secondName}** at **${formattedSecond}**.`;
  }

  if (rows.length > 0 && columns.length > 0) {
    return `Retrieved ${rows.length} records matching "${question}".`;
  }

  return fallbackExplanation || `Retrieved ${rows.length} financial records.`;
}

// Initialize OpenRouter Client
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3001",
    "X-Title": "Financial Text-to-SQL Assistant",
  },
});

// ============================================================================
// Authentication API Endpoints
// ============================================================================

app.post("/api/auth/signup", validateBody(signupSchema), async (req, res, next) => {
  try {
    const user = await registerUser(req.body);
    const token = generateToken(user);
    logger.info({ userEmail: user.email, role: user.role }, "User registered successfully.");
    res.json({ success: true, token, user });
  } catch (err) {
    if (err.message.includes("already exists")) {
      return res.status(409).json({ success: false, error: err.message });
    }
    next(err);
  }
});

app.post("/api/auth/signin", authLimiter, validateBody(signinSchema), async (req, res, next) => {
  try {
    const user = await loginUser(req.body);
    const token = generateToken(user);
    logger.info({ userEmail: user.email, role: user.role }, "User signed in successfully.");
    res.json({ success: true, token, user });
  } catch (err) {
    if (err.message.includes("Invalid email or password")) {
      return res.status(401).json({ success: false, error: err.message });
    }
    next(err);
  }
});

// ============================================================================
// Protected Chat Session Routes (Requires JWT Token)
// ============================================================================

app.get("/api/chats", authMiddleware, async (req, res, next) => {
  try {
    const userEmail = req.user.email;
    const chats = await getAllChats(userEmail);
    res.json({ success: true, chats });
  } catch (err) {
    next(err);
  }
});

app.get("/api/chats/:id", authMiddleware, async (req, res, next) => {
  try {
    const userEmail = req.user.email;
    const chat = await getChatById(req.params.id, userEmail);
    if (!chat) {
      return res.status(404).json({ success: false, error: "Chat thread not found." });
    }
    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
});

app.post("/api/chats", authMiddleware, async (req, res, next) => {
  try {
    const userEmail = req.user.email;
    const { title } = req.body;
    const chat = await createChat(userEmail, title || "New Chat");
    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
});

app.put("/api/chats/:id", authMiddleware, async (req, res, next) => {
  try {
    const userEmail = req.user.email;
    const chat = await updateChat(req.params.id, userEmail, req.body);
    if (!chat) {
      return res.status(404).json({ success: false, error: "Chat thread not found." });
    }
    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/chats/:id", authMiddleware, async (req, res, next) => {
  try {
    const userEmail = req.user.email;
    const deleted = await deleteChat(req.params.id, userEmail);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Chat thread not found." });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Main Text-to-SQL Query Generation Endpoint (Protected + Rate Limited)
// ============================================================================

app.post("/api/ask", authMiddleware, askLimiter, validateBody(askSchema), async (req, res, next) => {
  const startTime = Date.now();
  const { question, chatId } = req.body;
  const user = req.user;

  try {
    // 1. Check LRU Cache
    const cachedResponse = getCachedQuery(question);
    if (cachedResponse) {
      logAuditEntry({
        userEmail: user.email,
        ip: req.ip,
        queryType: "TEXT_TO_SQL_CACHE",
        question,
        sql: cachedResponse.sql,
        executionTimeMs: Date.now() - startTime,
        status: "SUCCESS",
        rowCount: cachedResponse.data?.rows?.length || 0,
      });

      return res.json({
        success: true,
        sql: cachedResponse.sql,
        data: cachedResponse.data,
        explanation: cachedResponse.explanation + " (Retrieved from LRU Cache)",
        cached: true,
      });
    }

    // 2. Fetch Multi-Turn History
    let conversationHistory = [];
    if (chatId) {
      const existingChat = await getChatById(chatId, user.email);
      if (existingChat && Array.isArray(existingChat.messages)) {
        conversationHistory = existingChat.messages.slice(-6).map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.sender === "ai" && m.sql ? `Generated SQL: ${m.sql}\nResponse: ${m.text}` : m.text,
        }));
      }
    }

    // 3. RAG Domain Knowledge Context
    const knowledgeDocs = retrieveRelevantKnowledge(question, 3);
    const ragContextText = knowledgeDocs.map((d) => `[Doc: ${d.title}]\n${d.content}`).join("\n\n");

    const promptMessages = [
      {
        role: "system",
        content: `${SCHEMA_DESCRIPTION}

Domain Knowledge & KPI Formulas:
${ragContextText}

Instructions:
1. Respond with a valid JSON object matching this schema:
   {
     "sql": "SELECT TOP 200 ...",
     "explanation": "Brief non-technical description of the results"
   }
2. ONLY output raw JSON. Do NOT wrap in Markdown code blocks.`,
      },
      ...conversationHistory,
      {
        role: "user",
        content: `User Question: "${question}"`,
      },
    ];

    let aiMessage = "";
    try {
      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: promptMessages,
        temperature: 0.1,
      });
      aiMessage = response.choices[0]?.message?.content || "";
    } catch (llmErr) {
      logger.error({ err: llmErr.message }, "OpenRouter API Call Failed");
      return res.status(502).json({
        success: false,
        error: "AI Model Provider Error. Unable to generate SQL at this time.",
      });
    }

    let parsed;
    try {
      const cleaned = aiMessage.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      logger.warn({ aiMessage }, "Failed to parse JSON response from LLM");
      return res.status(422).json({
        success: false,
        error: "Invalid AI response structure. Please rephrase your financial question.",
      });
    }

    const { sql: rawSql, explanation } = parsed;

    // 4. Security Sandbox AST Validation
    let validatedSql, tablesUsed;
    try {
      const validated = validateAndSanitizeSql(rawSql, {
        allowedTables: SCHEMA_TABLES,
        maxRows: 200,
      });
      validatedSql = validated.sql;
      tablesUsed = validated.tablesUsed;
    } catch (valErr) {
      logAuditEntry({
        userEmail: user.email,
        ip: req.ip,
        queryType: "TEXT_TO_SQL",
        question,
        sql: rawSql,
        executionTimeMs: Date.now() - startTime,
        status: "BLOCKED",
        error: valErr.message,
      });

      return res.status(400).json({
        success: false,
        error: valErr.message,
      });
    }

    // 5. RBAC Authorization & Where Injection
    const authCheck = isAuthorizedForTable(user, tablesUsed);
    if (!authCheck.authorized) {
      logAuditEntry({
        userEmail: user.email,
        ip: req.ip,
        queryType: "TEXT_TO_SQL",
        question,
        sql: validatedSql,
        executionTimeMs: Date.now() - startTime,
        status: "BLOCKED",
        error: authCheck.reason,
      });

      return res.status(403).json({
        success: false,
        error: `Access Denied: ${authCheck.reason}`,
      });
    }

    const safeSql = applyRbacConstraints(validatedSql, user);

    // 6. Execute Query against MSSQL or Mock Evaluator
    let columns = [];
    let rows = [];
    let source = "SQL_SERVER";

    try {
      const pool = await getPool();
      const request = pool.request();
      request.timeout = 8000;
      const result = await request.query(safeSql);

      columns = result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [];
      rows = result.recordset.map((row) => Object.values(row).map(String));
    } catch (dbErr) {
      logger.warn({ err: dbErr.message }, "SQL Server connection unavailable. Executing query against Mock Data Engine.");
      source = "MOCK_EVALUATOR";
      const mockResult = getMockQueryData(tablesUsed, safeSql);
      columns = mockResult.columns;
      rows = mockResult.rows;
    }

    const dataPayload = { columns, rows, source };

    // 7. Synthesize Direct Data Insight Answer from Query Results
    const aiAnswer = generateDataInsight(question, columns, rows, explanation);

    // 8. Store in LRU Cache
    setCachedQuery(question, { sql: safeSql, data: dataPayload, explanation, aiAnswer });

    // 9. Log Structured Audit Entry
    logAuditEntry({
      userEmail: user.email,
      ip: req.ip,
      queryType: "TEXT_TO_SQL",
      question,
      sql: safeSql,
      executionTimeMs: Date.now() - startTime,
      status: "SUCCESS",
      rowCount: rows.length,
    });

    res.json({
      success: true,
      sql: safeSql,
      data: dataPayload,
      explanation,
      aiAnswer,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Direct SQL Execution Sandbox Endpoint (Protected)
// ============================================================================

app.post("/api/execute-sql", authMiddleware, validateBody(executeSqlSchema), async (req, res, next) => {
  const startTime = Date.now();
  const { sql } = req.body;
  const user = req.user;

  try {
    const { sql: validatedSql, tablesUsed } = validateAndSanitizeSql(sql, {
      allowedTables: SCHEMA_TABLES,
      maxRows: 200,
    });

    const authCheck = isAuthorizedForTable(user, tablesUsed);
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, error: `Access Denied: ${authCheck.reason}` });
    }

    const safeSql = applyRbacConstraints(validatedSql, user);

    let columns = [];
    let rows = [];
    let source = "SQL_SERVER";

    try {
      const pool = await getPool();
      const request = pool.request();
      request.timeout = 8000;
      const result = await request.query(safeSql);

      columns = result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [];
      rows = result.recordset.map((row) => Object.values(row).map(String));
    } catch (dbErr) {
      source = "MOCK_EVALUATOR";
      const mockResult = getMockQueryData(tablesUsed, safeSql);
      columns = mockResult.columns;
      rows = mockResult.rows;
    }

    logAuditEntry({
      userEmail: user.email,
      ip: req.ip,
      queryType: "DIRECT_EXECUTE_SQL",
      question: "Direct Execution Sandbox",
      sql: safeSql,
      executionTimeMs: Date.now() - startTime,
      status: "SUCCESS",
      rowCount: rows.length,
    });

    res.json({
      success: true,
      sql: safeSql,
      data: { columns, rows, source },
    });
  } catch (err) {
    if (err instanceof SqlValidationError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next(err);
  }
});

// ============================================================================
// User Feedback & SQL Correction Endpoint (Protected)
// ============================================================================

app.post("/api/feedback", authMiddleware, async (req, res, next) => {
  try {
    const { question, generatedSql, rating, correctedSql, comment } = req.body;
    const feedback = await recordFeedback({
      userEmail: req.user.email,
      question,
      generatedSql,
      rating,
      correctedSql,
      comment,
    });
    res.json({ success: true, feedback });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Remote MCP (Model Context Protocol) SSE Endpoints
// ============================================================================

app.get("/mcp/sse", handleSseConnect);
app.post("/mcp/message", handleSseMessage);

// Centralized Global Express Error Handler Middleware
app.use(errorHandler);

// Boot Server
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
