# Production Model Context Protocol (MCP) Integration Guide

The Financial Text-to-SQL Assistant features a production-grade **Model Context Protocol (MCP) Server** (`backend/mcpServer.js`). It allows external AI tools (such as Claude Desktop, Cursor, or custom agents) to directly inspect database schemas, run safety-validated queries, query domain knowledge, and retrieve analyst prompts.

---

## 1. Exposed MCP Capabilities

### 📦 Resources (`financial://`)
| Resource URI | Description | MIME Type |
|---|---|---|
| `financial://schema` | Full T-SQL schema definition, table names, columns, data types, and entity rules. | `text/plain` |
| `financial://knowledge` | Investment performance definitions, benchmarks, and calculation formulas. | `application/json` |

### 🛠️ Tools
1. **`execute_financial_sql`**:
   - Executes SELECT-only queries with AST validation, RBAC checks (`admin`, `analyst`, `viewer`), timeout, and audit logging.
2. **`validate_sql_query`**:
   - Validates SQL safety (SELECT-only, table allowlist, TOP caps) without executing against the database.
3. **`search_domain_knowledge`**:
   - Performs RAG search over financial domain definitions and benchmark mappings.

### 💡 Prompts
- `financial_analyst_prompt`: Standard system prompt for financial data analysis.

---

## 2. Claude Desktop Integration

To connect Claude Desktop to your local Financial Assistant MCP Server:

Open your Claude Desktop config file:
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the following configuration:

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

Restart Claude Desktop. You will see the hammer 🛠️ icon containing `execute_financial_sql`, `validate_sql_query`, and `search_domain_knowledge`.

---

## 3. Cursor & VS Code Integration

In Cursor or VS Code (with MCP extension enabled):

1. Go to **Settings** → **MCP Servers** → **Add New Server**.
2. **Name**: `financial-mcp`
3. **Transport**: `stdio`
4. **Command**: `npm --prefix d:/text-to-sql-project/backend run mcp`

---

## 4. Running & Testing MCP via CLI

You can test running the MCP server directly in your terminal:

```bash
cd backend
npm run mcp
```

Output:
```
🚀 Production MCP Server connected via Stdio transport.
```
