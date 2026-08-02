#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { SCHEMA_DESCRIPTION, SCHEMA_TABLES } from "./schema.js";
import { validateAndSanitizeSql, SqlValidationError } from "./validateSql.js";
import { retrieveRelevantKnowledge, retrieveRelevantKnowledgeAsync, getAllKnowledgeDocs, getKnowledgeDocById, addKnowledgeDoc, deleteKnowledgeDoc } from "./knowledgeStore.js";
import { getPool } from "./db.js";
import { getMockQueryData } from "./mockData.js";
import { applyRbacConstraints, isAuthorizedForTable } from "./rbac.js";
import { logAuditEntry } from "./auditLogger.js";

const MAX_ROWS = 200;

// Initialize Model Context Protocol (MCP) Server
const server = new Server(
  {
    name: "financial-text-to-sql-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

// ---------------------------------------------------------------------------
// 1. MCP Resources
// ---------------------------------------------------------------------------

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const docs = await getAllKnowledgeDocs();
  const docResources = docs.map((doc) => ({
    uri: `financial://knowledge/${doc.id}`,
    name: doc.title,
    description: `[${doc.category}] ${doc.content.slice(0, 100)}...`,
    mimeType: "text/plain",
  }));

  return {
    resources: [
      {
        uri: "financial://schema",
        name: "Financial Database Schema",
        description: "Full T-SQL schema definition, table names, columns, data types, and sample entity names.",
        mimeType: "text/plain",
      },
      {
        uri: "financial://knowledge",
        name: "Financial Domain Knowledge Base (All Documents)",
        description: "All financial domain knowledge documents with TF-IDF scoring metadata.",
        mimeType: "application/json",
      },
      ...docResources,
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "financial://schema") {
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `ALLOWED TABLES:\n${JSON.stringify(SCHEMA_TABLES, null, 2)}\n\nDETAILED SCHEMA:\n${SCHEMA_DESCRIPTION}`,
        },
      ],
    };
  }

  if (uri === "financial://knowledge") {
    const docs = await getAllKnowledgeDocs();
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(docs, null, 2),
        },
      ],
    };
  }

  // Per-document resource: financial://knowledge/{id}
  const docMatch = uri.match(/^financial:\/\/knowledge\/(.+)$/);
  if (docMatch) {
    const docId = docMatch[1];
    const doc = await getKnowledgeDocById(docId);
    if (!doc) throw new Error(`Knowledge document not found: ${docId}`);
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `[${doc.category}] ${doc.title}\n\n${doc.content}\n\nKeywords: ${doc.keywords.join(", ")}`,
        },
      ],
    };
  }

  throw new Error(`Resource not found: ${uri}`);
});

// ---------------------------------------------------------------------------
// 2. MCP Tools
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "execute_financial_sql",
        description: "Safely execute a SELECT-only T-SQL query with AST validation, RBAC checks, and audit logging.",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string", description: "The T-SQL SELECT statement to validate and execute." },
            userEmail: { type: "string", description: "User email for RBAC scoping and audit logs." },
            userRole: { type: "string", enum: ["admin", "analyst", "viewer"], description: "User role for permissions (default: analyst)." },
            userRegion: { type: "string", description: "Region filter for row-level security." },
          },
          required: ["sql"],
        },
      },
      {
        name: "validate_sql_query",
        description: "Validate a T-SQL query for safety compliance without executing it.",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string", description: "The T-SQL query to validate." },
          },
          required: ["sql"],
        },
      },
      {
        name: "search_domain_knowledge",
        description: "TF-IDF search over MongoDB-persisted RAG knowledge base of investment definitions, schema conventions, and SQL patterns.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Natural language query or financial keyword." },
            limit: { type: "number", description: "Max documents to return (default: 3)." },
          },
          required: ["query"],
        },
      },
      {
        name: "list_knowledge_documents",
        description: "List all documents in the financial RAG knowledge base.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "add_knowledge_document",
        description: "Add a new domain knowledge document to the financial RAG knowledge base. It will be immediately searchable.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Unique document ID (snake_case, e.g. 'esg_strategy_guide')." },
            category: { type: "string", description: "Category (e.g. 'SQL Best Practices', 'Domain Calculations & Rules')." },
            title: { type: "string", description: "Short human-readable title." },
            keywords: { type: "array", items: { type: "string" }, description: "List of keyword strings for scoring." },
            content: { type: "string", description: "Full document content text." },
          },
          required: ["id", "category", "title", "keywords", "content"],
        },
      },
      {
        name: "delete_knowledge_document",
        description: "Remove a knowledge document from the RAG knowledge base by its ID.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Document ID to delete." },
          },
          required: ["id"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "validate_sql_query") {
    try {
      const { sql: safeSql, tablesUsed } = validateAndSanitizeSql(args.sql, {
        allowedTables: SCHEMA_TABLES,
        maxRows: MAX_ROWS,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ valid: true, safeSql, tablesUsed }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ valid: false, error: err.message }, null, 2),
          },
        ],
      };
    }
  }

  if (name === "search_domain_knowledge") {
    const limit = args.limit || 3;
    const docs = await retrieveRelevantKnowledgeAsync(args.query, limit);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(docs.map(({ id, category, title, keywords, content, score }) => ({ id, category, title, keywords, content, score })), null, 2),
        },
      ],
    };
  }

  if (name === "list_knowledge_documents") {
    const docs = await getAllKnowledgeDocs();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(docs.map(({ id, category, title, keywords }) => ({ id, category, title, keywords })), null, 2),
        },
      ],
    };
  }

  if (name === "add_knowledge_document") {
    const newDoc = await addKnowledgeDoc(args);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, document: newDoc }, null, 2),
        },
      ],
    };
  }

  if (name === "delete_knowledge_document") {
    const deleted = await deleteKnowledgeDoc(args.id);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: deleted, id: args.id }, null, 2),
        },
      ],
    };
  }

  if (name === "execute_financial_sql") {
    const startTime = Date.now();
    const user = {
      email: args.userEmail || "mcp_client@financial-assistant.com",
      role: args.userRole || "analyst",
      region: args.userRegion || "",
    };

    try {
      const { sql: validatedSql, tablesUsed } = validateAndSanitizeSql(args.sql, {
        allowedTables: SCHEMA_TABLES,
        maxRows: MAX_ROWS,
      });

      const authCheck = isAuthorizedForTable(user, tablesUsed);
      if (!authCheck.authorized) {
        throw new Error(`RBAC Denied: ${authCheck.reason}`);
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
        ip: "mcp-transport",
        queryType: "TEXT_TO_SQL",
        question: "MCP Tool Call: execute_financial_sql",
        sql: safeSql,
        executionTimeMs: Date.now() - startTime,
        status: "SUCCESS",
        rowCount: rows.length,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                source,
                sql: safeSql,
                tablesUsed,
                columns,
                rows,
                rowCount: rows.length,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      logAuditEntry({
        userEmail: user.email,
        ip: "mcp-transport",
        queryType: "TEXT_TO_SQL",
        question: "MCP Tool Call: execute_financial_sql",
        sql: args.sql,
        executionTimeMs: Date.now() - startTime,
        status: "FAILURE",
        rowCount: 0,
        error: err.message,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: err.message }, null, 2),
          },
        ],
      };
    }
  }

  throw new Error(`Tool not found: ${name}`);
});

// ---------------------------------------------------------------------------
// 3. MCP Prompts
// ---------------------------------------------------------------------------

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "financial_analyst_prompt",
        description: "Standard system prompt instructions for generating safe T-SQL SELECT statements from financial questions.",
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;

  if (name === "financial_analyst_prompt") {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `You are an expert financial AI analyst. Only generate SELECT statements using T-SQL syntax. Schema:\n${SCHEMA_DESCRIPTION}`,
          },
        },
      ],
    };
  }

  throw new Error(`Prompt not found: ${name}`);
});

// ---------------------------------------------------------------------------
// 4. Server Transport Startup
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 Production MCP Server connected via Stdio transport.");
}

main().catch((err) => {
  console.error("❌ MCP Server initialization error:", err);
  process.exit(1);
});
