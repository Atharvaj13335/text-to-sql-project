# Production Model Context Protocol (MCP) Integration Guide

The Financial Text-to-SQL Assistant features a production-grade **Model Context Protocol (MCP) Server**. It supports two transport modes:
1. **Local Stdio Transport** (`backend/mcpServer.js`): For local CLI testing and developer workstations.
2. **Remote SSE Transport** (`GET /mcp/sse` & `POST /mcp/message` in `server.js`): For serving remote AI clients over standard HTTP/HTTPS anywhere in the world at **$0 extra cost**.

---

## 1. Exposed MCP Capabilities

### 📦 Resources (`financial://`)
| Resource URI | Description | MIME Type |
|---|---|---|
| `financial://schema` | Full T-SQL schema definition, table names, columns, data types. | `text/plain` |
| `financial://knowledge` | All financial domain knowledge documents with TF-IDF metadata. | `application/json` |
| `financial://knowledge/{id}` | Specific knowledge document (e.g., `financial://knowledge/gips_compliance`). | `text/plain` |

### 🛠️ Tools
1. `execute_financial_sql`: Safely execute SELECT queries with AST validation, RBAC enforcement (`admin`, `analyst`, `viewer`), timeout, and MongoDB audit logging.
2. `validate_sql_query`: Pre-validate SQL query safety without execution.
3. `search_domain_knowledge`: TF-IDF weighted search over RAG knowledge base.
4. `list_knowledge_documents`: List all active knowledge documents.
5. `add_knowledge_document`: Add a new document to the RAG knowledge store.
6. `delete_knowledge_document`: Remove a knowledge document by ID.

### 💡 Prompts
- `financial_analyst_prompt`: Standard system prompt for financial data analysis.

---

## 2. Remote Production Setup (SSE over HTTP/HTTPS)

When your backend (`server.js`) is running locally or deployed to the cloud (AWS, Azure, Render, Docker):

### Public Endpoints:
- **SSE Stream**: `GET http://localhost:3001/mcp/sse` (or `https://your-domain.com/mcp/sse`)
- **Message Receiver**: `POST http://localhost:3001/mcp/message?sessionId=...`

Any remote user or client application can connect using standard HTTP/HTTPS!

---

## 3. Local Claude Desktop Integration (Stdio Mode)

Open your Claude Desktop config file:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "financial-text-to-sql": {
      "command": "node",
      "args": [
        "d:/text-to-sql-project/backend/mcpServer.js"
      ],
      "env": {
        "JWT_SECRET": "f1n4nc14l_4ss1st4nt_s3cr3t_k3y_2026_x7z",
        "OPENROUTER_API_KEY": "your_openrouter_api_key_here",
        "DB_SERVER": "localhost",
        "DB_NAME": "FinancialReporting"
      }
    }
  }
}
```

---

## 4. Cursor / VS Code Integration

1. Go to **Settings** → **MCP Servers** → **Add New Server**.
2. **Name**: `financial-mcp`
3. **Transport**: `stdio`
4. **Command**: `npm --prefix d:/text-to-sql-project/backend run mcp`
