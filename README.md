# Production-Grade Financial Text-to-SQL & MCP Assistant

[![CI Pipeline](https://github.com/Atharvaj13335/text-to-sql-project/actions/workflows/ci.yml/badge.svg)](https://github.com/Atharvaj13335/text-to-sql-project/actions)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-brightgreen)](https://nodejs.org)
[![MCP Protocol](https://img.shields.io/badge/MCP-v1.0.0-purple)](https://modelcontextprotocol.io)

An enterprise-grade, security-hardened **Financial Text-to-SQL Assistant** and **Model Context Protocol (MCP) Server**. Translates natural language financial questions into AST-validated, RBAC-scoped T-SQL queries against portfolio performance, benchmark indices, and client accounts.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Clients["Client Access Layers"]
        A[React Frontend Web App]
        B[Claude Desktop / Cursor via MCP Stdio]
        C[Remote AI Agents via MCP SSE HTTP]
    end

    subgraph SecurityGate["5-Tier Security & Validation Sandbox"]
        D[JWT Bearer Auth & Rate Limiter]
        E[AST SQL Safety Validator node-sql-parser]
        F[Server-Side RBAC Engine rbac.js]
        G[Zod Request Body Validator]
    end

    subgraph CoreEngine["Execution & Data Engine"]
        H[LRU Query Cache lru-cache]
        I[TF-IDF RAG Knowledge Store knowledgeStore.js]
        J[Structured Audit Logger Pino + MongoDB]
    end

    subgraph DataSources["Persistence Layers"]
        K[(SQL Server / Mock Engine)]
        L[(MongoDB Atlas)]
    end

    A --> D --> E --> F --> H
    B --> E
    C --> D
    F --> K
    F --> J --> L
    E --> I
```

---

## ✨ Production Features & 5-Tier Security Architecture

### 🛡️ Tier 1 — Hardened Authentication & Access Control
- **Strict JWT Bearer Authentication**: Removed legacy header bypass mechanisms (`x-user-email`); mandatory JWT verification on all protected endpoints (`/api/chats`, `/api/ask`, `/api/execute-sql`).
- **Bcrypt Password Security**: Passwords hashed using `bcryptjs` with salt rounds on registration and login.
- **Fail-Fast Startup**: Mandatory `JWT_SECRET` validation at startup — server refuses to boot with insecure fallback keys.
- **Sliding-Window Rate Limiting**: `express-rate-limit` throttles brute-force attempts on `/api/auth/signin` (5 requests/min per IP) and `/api/ask` (30 requests/min per IP).

### 🔒 Tier 2 — Server-Side RBAC & Persistent Audit Trail
- **Role-Based & Region Scoping (`rbac.js`)**: Users assigned roles (`admin`, `analyst`, `viewer`) and regional constraints (e.g. `North America`).
- **Server-Side Query Injection**: Security restrictions are injected as `WHERE` constraints server-side post-validation — never relying on LLMs to self-restrict.
- **MongoDB Audit Persistence (`auditLogger.js`)**: Every query, validation result, user email, execution duration, and row count is persisted to MongoDB `AuditLog` collection and appended to `logs/audit.jsonl`.
- **Azure Key Vault Guide**: Production guide for secret management in `docs/VAULT_SECRETS_GUIDE.md`.

### ⚡ Tier 3 — Reliability, Performance & Cost Control
- **LRU Query Caching (`queryCache.js`)**: Identical SQL queries and questions are cached using `lru-cache` with a 1-hour TTL, saving LLM API tokens.
- **Pino Structured Logging (`logger.js`)**: High-performance JSON logging with `pino` and `pino-pretty` formatting.
- **Startup Environment Validator (`envValidator.js`)**: Validates `MONGO_URI`, `OPENROUTER_API_KEY`, `JWT_SECRET`, and `DB_SERVER` on boot.

### 🧠 Tier 4 — Product Depth & LLM Regression Suite
- **Multi-Turn Conversation Memory**: Retains conversation history array across follow-up queries.
- **Correction Loop (`feedbackStore.js`)**: `POST /api/feedback` endpoint records thumbs-up/down ratings and SQL user edits for model fine-tuning.
- **LLM & AST Safety Test Suite (`tests/llmRegression.test.js`)**: Automated regression tests for SQL structural safety and keyword blocking.

### 🔌 Tier 5 — Model Context Protocol (MCP) Server & TF-IDF RAG
- **Dual MCP Transports**:
  - **Local Stdio (`mcpServer.js`)**: Subprocess transport for local developer CLI, Claude Desktop, and Cursor.
  - **Remote SSE (`mcpSse.js`)**: `GET /mcp/sse` & `POST /mcp/message` endpoints for multi-user remote connections over HTTP/HTTPS at **$0 extra cost**.
- **MongoDB-Backed TF-IDF RAG Engine (`knowledgeStore.js`)**: Stores domain investment rules, benchmark formulas, GIPS compliance rules, and risk metrics. Automatically calculates TF-IDF relevance scores.
- **Exposed MCP Tools & Resources**:
  - `financial://schema` & `financial://knowledge/{id}`
  - `execute_financial_sql`, `validate_sql_query`, `search_domain_knowledge`, `list_knowledge_documents`, `add_knowledge_document`, `delete_knowledge_document`.

---

## 💻 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Lucide Icons, Glassmorphism UI
- **Backend**: Node.js 18+, Express, `@modelcontextprotocol/sdk`, Mongoose, `mssql`, `node-sql-parser`, `bcryptjs`, `jsonwebtoken`, `zod`, `pino`, `lru-cache`, `express-rate-limit`
- **DevOps**: Docker, Docker Compose, GitHub Actions CI

---

## 🚀 Quickstart & Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or MongoDB Atlas)
- SQL Server (optional; falls back to mock evaluation automatically)

### 1. Environment Setup

Copy `.env.example` to `backend/.env`:

```env
PORT=3001
JWT_SECRET=f1n4nc14l_4ss1st4nt_s3cr3t_k3y_2026_x7z
OPENROUTER_API_KEY=your_openrouter_api_key_here
AI_MODEL=openai/gpt-4o-mini
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/text_to_sql
FRONTEND_URL=http://localhost:5173

# Optional SQL Server Config
DB_SERVER=localhost
DB_NAME=FinancialReporting
DB_USER=sa
DB_PASSWORD=YourPassword123
```

### 2. Local Installation & Development

```bash
# Clone repository
git clone https://github.com/Atharvaj13335/text-to-sql-project.git
cd text-to-sql-project

# Install and start backend
cd backend
npm install
npm run dev

# Install and start frontend (in new terminal)
cd ../frontend
npm install
npm run dev
```

Visit the Web App at **`http://localhost:5173`**.

---

## 🐳 Docker Deployment

Run the complete multi-service stack (Node.js API + MongoDB) with a single command:

```bash
docker-compose up --build -d
```

Check backend health: `curl http://localhost:3001/api/chats`

---

## 🔌 Connecting to Claude Desktop or Cursor via MCP

### Claude Desktop Setup (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "financial-assistant": {
      "command": "node",
      "args": ["d:/text-to-sql-project/backend/mcpServer.js"],
      "env": {
        "JWT_SECRET": "f1n4nc14l_4ss1st4nt_s3cr3t_k3y_2026_x7z",
        "OPENROUTER_API_KEY": "your_key_here"
      }
    }
  }
}
```

Detailed guide: [`backend/docs/MCP_INTEGRATION_GUIDE.md`](file:///d:/text-to-sql-project/backend/docs/MCP_INTEGRATION_GUIDE.md).

---

## 🧪 Running Tests

```bash
cd backend
npm test
```

Runs the automated LLM regression test suite validating AST SQL safety, table allowlists, and SELECT-only enforcement.

---

## 📄 License

This project is licensed under the ISC License.
