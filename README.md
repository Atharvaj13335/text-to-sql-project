<div align="center">

# 🏦 Financial Text-to-SQL Assistant

### *Enterprise-Grade Natural Language to SQL Engine with MCP Server*

[![CI Pipeline](https://github.com/Atharvaj13335/text-to-sql-project/actions/workflows/ci.yml/badge.svg)](https://github.com/Atharvaj13335/text-to-sql-project/actions)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-brightgreen)](https://nodejs.org)
[![MCP Protocol](https://img.shields.io/badge/MCP-v1.30-purple)](https://modelcontextprotocol.io)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)](https://www.mongodb.com/atlas)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)

**Ask financial questions in plain English. Get T-SQL. Get real data. Instantly.**

[Live Demo](#-quickstart) · [API Reference](#-api-reference) · [MCP Guide](#-model-context-protocol-mcp-server) · [Architecture](#-architecture)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Quickstart](#-quickstart)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Model Context Protocol (MCP) Server](#-model-context-protocol-mcp-server)
- [Security Architecture](#-security-architecture)
- [Running Tests](#-running-tests)
- [Docker Deployment](#-docker-deployment)
- [Contributing](#-contributing)

---

## 🔍 Overview

The **Financial Text-to-SQL Assistant** is a production-hardened, full-stack system that translates natural language financial questions into validated, role-scoped T-SQL queries — executed live against a financial portfolio database (SQL Server) or a built-in mock evaluator.

Built as an intern project covering enterprise-level concerns:

- 🔐 **5-Tier Security**: JWT + bcrypt + AST SQL validation + RBAC + rate limiting
- 🧠 **AI-Powered**: OpenRouter LLM (GPT-4o-mini / Claude) with TF-IDF RAG context injection
- 🔌 **MCP Server**: Dual-transport (Stdio + HTTP/SSE) for Claude Desktop, Cursor, or any MCP-compatible AI agent
- 📊 **Rich UI**: Glassmorphism React frontend with charts, multi-turn chat, and SQL editor sandbox
- 🏭 **Enterprise Architecture**: Layered `src/` module system with audit logging, LRU caching, and structured Pino logs

> Financial queries that previously required a SQL developer now take seconds for any analyst.

---

## ✨ Features

### Core Capabilities
| Feature | Description |
|---|---|
| **Natural Language → T-SQL** | Ask any financial question; the LLM generates validated T-SQL |
| **Mathematical Analytics** | SUM, AVG, STDEV, weighted averages, CASE WHEN, spreads, DATEDIFF |
| **Multi-Turn Memory** | Conversation history injected for follow-up/context-aware queries |
| **TF-IDF RAG Engine** | Relevant domain knowledge (GIPS rules, KPI formulas) injected per query |
| **Data Insight Synthesis** | Server-side synthesizer generates plain-English answers from actual query results |
| **SQL Edit Sandbox** | Users can edit and re-execute any generated SQL from the UI |
| **Mock Data Fallback** | Auto-falls back to Mock Evaluator if SQL Server is unavailable |
| **LRU Query Cache** | Identical questions served from cache — saves LLM API tokens |
| **Feedback Loop** | Users rate and correct SQL; stored for future model fine-tuning |

### Security & Compliance
| Layer | Implementation |
|---|---|
| **Authentication** | Strict JWT Bearer (HS256), bcryptjs password hashing |
| **AST SQL Validation** | `node-sql-parser` rejects all non-SELECT statements at AST level |
| **RBAC** | Role + region scoping with server-side WHERE clause injection |
| **Rate Limiting** | 5 req/min (auth), 30 req/min (queries) via `express-rate-limit` |
| **Zod Validation** | All request bodies validated against strict Zod schemas |
| **Audit Logging** | Every query logged to MongoDB + `audit.jsonl` with user, IP, timing |
| **Startup Validation** | Server refuses to boot without valid `JWT_SECRET`, `MONGO_URI`, `OPENROUTER_API_KEY` |
| **CORS Policy** | Strict origin allowlist — rejects unauthorized frontends |

---

## 🏛️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                    │
│   React Web App (:5173)    Claude Desktop (MCP Stdio)   AI Agent (SSE)  │
└────────────┬────────────────────────┬──────────────────────┬─────────────┘
             │                        │                      │
             ▼                        ▼                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    SECURITY GATEWAY (:3001)                              │
│  JWT Auth  →  Rate Limiter  →  Zod Validator  →  CORS Policy           │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
             ┌───────────────────┼───────────────────┐
             ▼                   ▼                   ▼
    ┌─────────────────┐  ┌────────────┐  ┌──────────────────┐
    │  LRU Query Cache│  │  OpenRouter │  │  RAG Engine      │
    │  (Cache Hit →   │  │  LLM (GPT- │  │  (TF-IDF,        │
    │   Skip LLM)     │  │  4o-mini)  │  │  MongoDB-backed) │
    └────────┬────────┘  └─────┬──────┘  └────────┬─────────┘
             │                  │                   │
             └──────────────────▼───────────────────┘
                         Generated SQL
                                │
             ┌──────────────────▼─────────────────────┐
             │         SECURITY SANDBOX                │
             │   AST Validator → RBAC Engine →        │
             │   WHERE Constraint Injection            │
             └──────────────────┬─────────────────────┘
                                │
             ┌──────────────────▼──────────────────────┐
             │           DATA ENGINE                    │
             │   SQL Server (live) / Mock Evaluator    │
             │       (auto-fallback)                   │
             └──────────────────┬──────────────────────┘
                                │
             ┌──────────────────▼──────────────────────┐
             │        OBSERVABILITY LAYER               │
             │  Pino Logs  +  MongoDB Audit Trail      │
             └─────────────────────────────────────────┘
```

### Data Flow for a Query

```
User types: "Which composites outperform their benchmark?"
     │
     ├─ 1. JWT verified → Rate limit checked → Zod body validated
     ├─ 2. LRU Cache miss → fetch multi-turn history
     ├─ 3. RAG retrieves relevant GIPS/benchmark knowledge docs
     ├─ 4. LLM generates SQL + explanation (with few-shot examples)
     ├─ 5. AST Validator: ensures SELECT-only, table allowlist, TOP 200 cap
     ├─ 6. RBAC: table access check + WHERE region/role injection
     ├─ 7. Execute on SQL Server (or Mock Evaluator fallback)
     ├─ 8. Data insight synthesizer generates plain-English answer from rows
     ├─ 9. Cache result in LRU store
     └─ 10. Audit log: user, IP, SQL, row count, execution time → MongoDB
```

---

## 💻 Tech Stack

### Backend
| Category | Technology |
|---|---|
| Runtime | Node.js v18+ (ES Modules) |
| Web Framework | Express 4 |
| AI / LLM | OpenRouter API (GPT-4o-mini, Claude Sonnet 4.5) |
| MCP SDK | `@modelcontextprotocol/sdk` v1.30 |
| Database (App) | MongoDB Atlas via Mongoose |
| Database (Data) | Microsoft SQL Server via `mssql` |
| SQL Security | `node-sql-parser` (AST-level validation) |
| Authentication | `jsonwebtoken` (HS256 JWT), `bcryptjs` |
| Caching | `lru-cache` |
| Validation | `zod` |
| Logging | `pino` + `pino-pretty` |
| Rate Limiting | `express-rate-limit` |

### Frontend
| Category | Technology |
|---|---|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS (glassmorphism, dark mode) |
| Charts | Recharts (Bar + Line charts) |
| Icons | Lucide React |
| Animations | CSS keyframes (particle field, drift glow, pop-up) |

### DevOps
| Category | Technology |
|---|---|
| Containerization | Docker + Docker Compose |
| CI Pipeline | GitHub Actions (lint + test on push/PR) |
| Secret Management | `.env` (dev) / Azure Key Vault guide (prod) |

---

## 📁 Project Structure

```
text-to-sql-project/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js               # MSSQL connection pool
│   │   │   ├── envValidator.js     # Startup env validation (fail-fast)
│   │   │   └── schema.js           # DB schema + math analytics prompt
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js   # JWT Bearer verification
│   │   │   ├── validatorMiddleware.js  # Zod schema validators
│   │   │   └── errorHandler.js    # Centralized Express error handler
│   │   ├── security/
│   │   │   ├── validateSql.js      # AST SQL safety validator (node-sql-parser)
│   │   │   ├── rbac.js             # Role+region RBAC engine
│   │   │   └── auditLogger.js      # MongoDB + JSONL audit trail
│   │   ├── services/
│   │   │   ├── knowledgeStore.js   # TF-IDF RAG engine (MongoDB-backed)
│   │   │   ├── queryCache.js       # LRU query cache
│   │   │   ├── chatStore.js        # Multi-session chat persistence
│   │   │   ├── userStore.js        # User registration + bcrypt auth
│   │   │   ├── feedbackStore.js    # SQL correction feedback loop
│   │   │   └── mockData.js        # Mock data evaluator fallback
│   │   ├── mcp/
│   │   │   ├── mcpServer.js        # Stdio MCP (local / Claude Desktop)
│   │   │   └── mcpSse.js           # Remote SSE MCP (HTTP/HTTPS, $0 cost)
│   │   └── utils/
│   │       └── logger.js           # Pino structured logger instance
│   ├── tests/
│   │   ├── runTests.js             # Main test runner (9 tests)
│   │   ├── validateSql.test.js     # AST safety test suite
│   │   └── llmRegression.test.js  # SQL regression test suite
│   ├── docs/
│   │   ├── MCP_INTEGRATION_GUIDE.md
│   │   └── VAULT_SECRETS_GUIDE.md
│   ├── server.js                   # Express app entry point
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface.jsx   # Main chat UI + SQL disclosure
│   │   │   ├── AuthModal.jsx       # Sign in / Sign up modal
│   │   │   └── ParticleField.jsx   # Animated starfield background
│   │   └── App.jsx                 # Root app, sidebar, chat routing
│   └── vite.config.js              # Vite proxy → backend :3001
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quickstart

### Prerequisites

- **Node.js** v18+ — [nodejs.org](https://nodejs.org)
- **MongoDB Atlas** (free tier) or local MongoDB
- **OpenRouter API Key** — [openrouter.ai](https://openrouter.ai) (free credits available)
- **SQL Server** *(optional)* — falls back to Mock Evaluator automatically

### 1. Clone the Repository

```bash
git clone https://github.com/Atharvaj13335/text-to-sql-project.git
cd text-to-sql-project
```

### 2. Configure Environment

Create `backend/.env`:

```env
# ── Required ──────────────────────────────────────────────────────
PORT=3001
JWT_SECRET=your_strong_secret_key_minimum_32_characters
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/text_to_sql

# ── AI Model (optional, defaults to gpt-4o-mini) ──────────────────
AI_MODEL=openai/gpt-4o-mini
# Alternatives: anthropic/claude-sonnet-4-5 | openai/gpt-4o

# ── Frontend CORS ─────────────────────────────────────────────────
FRONTEND_URL=http://localhost:5173

# ── SQL Server (optional, auto-falls back to Mock Evaluator) ──────
DB_SERVER=localhost
DB_NAME=FinancialReporting
DB_USER=sa
DB_PASSWORD=YourPassword123
```

### 3. Start Backend

```bash
cd backend
npm install
npm run dev       # Development mode with hot-reload (--watch)
# npm start       # Production mode
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Open the App

Visit **[http://localhost:5173](http://localhost:5173)** → Sign up → Start querying!

---

## 🔐 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | ✅ | HS256 JWT signing secret (min 32 chars). Server refuses to start without it. |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter API key for LLM access |
| `MONGO_URI` | ✅ | MongoDB connection URI (Atlas or local) |
| `PORT` | ❌ | HTTP port (default: `3001`) |
| `AI_MODEL` | ❌ | OpenRouter model ID (default: `openai/gpt-4o-mini`) |
| `FRONTEND_URL` | ❌ | CORS allowed origin (default: `http://localhost:5173`) |
| `DB_SERVER` | ❌ | SQL Server hostname (optional) |
| `DB_NAME` | ❌ | SQL Server database name |
| `DB_USER` | ❌ | SQL Server login username |
| `DB_PASSWORD` | ❌ | SQL Server login password |

---

## 📡 API Reference

All protected endpoints require `Authorization: Bearer <token>` header.

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Register a new user | ❌ |
| `POST` | `/api/auth/signin` | Login and receive JWT token | ❌ |

**Signup Body:**
```json
{ "name": "John Doe", "email": "john@example.com", "password": "SecurePass123!" }
```

**Signin Response:**
```json
{ "success": true, "token": "eyJhbGci...", "user": { "name": "John Doe", "email": "...", "role": "analyst" } }
```

---

### Query Engine

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/ask` | Translate natural language to SQL and execute | ✅ |
| `POST` | `/api/execute-sql` | Execute custom/edited SQL in the sandbox | ✅ |

**`POST /api/ask` Body:**
```json
{
  "question": "Which composites outperform their benchmark by more than 5%?",
  "chatId": "chat_1234567890_abc12"
}
```

**Response:**
```json
{
  "success": true,
  "sql": "SELECT TOP 200 cp.CompositeName, ROUND(cp.YTDReturn - b.BenchmarkReturn, 2) AS ActiveReturn ...",
  "data": {
    "columns": ["CompositeName", "YTDReturn", "BenchmarkReturn", "ActiveReturn"],
    "rows": [["Tech Innovation Fund", "24.10", "18.20", "5.90"]],
    "source": "MOCK_EVALUATOR"
  },
  "explanation": "Composites beating their benchmarks year-to-date.",
  "aiAnswer": "Retrieved 1 record. Tech Innovation Fund leads with 5.90%."
}
```

---

### Chat Sessions

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/chats` | List all chat sessions for current user | ✅ |
| `GET` | `/api/chats/:id` | Get full chat session with messages | ✅ |
| `POST` | `/api/chats` | Create new chat session | ✅ |
| `PUT` | `/api/chats/:id` | Update chat title or messages | ✅ |
| `DELETE` | `/api/chats/:id` | Delete chat session | ✅ |

---

### Feedback

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/feedback` | Submit rating + corrected SQL for a query | ✅ |

```json
{
  "question": "Top 5 composites by YTD return",
  "generatedSql": "SELECT TOP 200 ...",
  "rating": 4,
  "correctedSql": "SELECT TOP 5 ...",
  "comment": "Result count was too high"
}
```

---

### MCP (Model Context Protocol)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/mcp/sse` | SSE stream endpoint for remote MCP clients | ❌ |
| `POST` | `/mcp/message` | Send MCP messages to the server | ❌ |

---

## 🔌 Model Context Protocol (MCP) Server

The backend exposes a full **MCP Server** with two transport modes — at zero additional infrastructure cost.

### Transport Modes

| Mode | Transport | Use Case | Command |
|---|---|---|---|
| **Local** | Stdio subprocess | Claude Desktop, Cursor, CLI tools | `npm run mcp` |
| **Remote** | HTTP/SSE streaming | Cloud deployments, multi-user agents | `GET /mcp/sse` |

### Exposed Resources

| Resource URI | Description |
|---|---|
| `financial://schema` | Full T-SQL database schema definition |
| `financial://knowledge/{id}` | Individual RAG knowledge document by ID |

### Exposed Tools

| Tool | Description |
|---|---|
| `execute_financial_sql` | Execute validated, RBAC-scoped T-SQL query |
| `validate_sql_query` | AST-validate a SQL string without executing |
| `search_domain_knowledge` | TF-IDF semantic search of financial knowledge base |
| `list_knowledge_documents` | List all RAG documents titles + IDs |
| `add_knowledge_document` | Add new domain knowledge to the RAG store |
| `delete_knowledge_document` | Remove a knowledge document by ID |

### Exposed Prompts

| Prompt | Description |
|---|---|
| `financial_analyst_prompt` | Pre-built system prompt for financial SQL analysis |

### Claude Desktop Setup

Add to `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "financial-assistant": {
      "command": "node",
      "args": ["C:/path/to/text-to-sql-project/backend/src/mcp/mcpServer.js"],
      "env": {
        "JWT_SECRET": "your_jwt_secret",
        "OPENROUTER_API_KEY": "your_openrouter_key",
        "MONGO_URI": "your_mongodb_uri"
      }
    }
  }
}
```

**Remote MCP (Cloud):**
```
SSE Endpoint:     GET  http://your-server:3001/mcp/sse
Message Endpoint: POST http://your-server:3001/mcp/message
```

Full guide: [`backend/docs/MCP_INTEGRATION_GUIDE.md`](backend/docs/MCP_INTEGRATION_GUIDE.md)

---

## 🛡️ Security Architecture

### 5-Tier Defense Model

```
Request
  │
  ├─ Tier 1: JWT Bearer Authentication
  │     └─ Mandatory JWT_SECRET at startup (fail-fast)
  │     └─ bcryptjs password hashing (salted)
  │     └─ Rate limiting: 5/min (auth), 30/min (queries)
  │
  ├─ Tier 2: Request Validation
  │     └─ Zod schema validation on all POST bodies
  │     └─ CORS origin allowlist enforcement
  │
  ├─ Tier 3: SQL Security Sandbox (AST Level)
  │     └─ node-sql-parser AST validation — not string matching
  │     └─ Blocks: INSERT/UPDATE/DELETE/DROP/ALTER/EXEC/TRUNCATE/MERGE
  │     └─ Blocks: Multi-statement queries (;-separated)
  │     └─ Blocks: Tables not in allowlist [CompositePerformance, Account, Benchmark]
  │     └─ Enforces: TOP 200 row cap on all queries
  │
  ├─ Tier 4: RBAC Engine
  │     └─ Role-based table access (admin > analyst > viewer)
  │     └─ Region-based WHERE constraint injection (server-side)
  │     └─ Never relies on LLM to self-restrict access
  │
  └─ Tier 5: Observability
        └─ MongoDB AuditLog: user, IP, SQL, timing, status, rowCount
        └─ JSONL append log: logs/audit.jsonl
        └─ Pino structured JSON logs to stdout
```

### SQL Validation Examples

| Input SQL | Result |
|---|---|
| `SELECT CompositeName FROM CompositePerformance` | ✅ Passed + `TOP 200` injected |
| `DELETE FROM CompositePerformance` | ❌ Blocked: non-SELECT |
| `SELECT * FROM UsersSecret` | ❌ Blocked: unauthorized table |
| `SELECT * FROM Account; DROP TABLE Account` | ❌ Blocked: multi-statement |
| `SELECT TOP 5000 * FROM Account` | ✅ Passed but capped to `TOP 200` |

---

## 🧪 Running Tests

```bash
cd backend
npm test
```

**Test Suite Results (`tests/runTests.js`):**
```
🧪 Running Financial Text-to-SQL Test Suite...

 ✅ PASS: accepts valid SELECT statement and caps TOP 200
 ✅ PASS: respects existing TOP clause if below max limit
 ✅ PASS: downscales TOP clause if above max limit
 ✅ PASS: rejects non-SELECT statements (INSERT/DELETE/DROP)
 ✅ PASS: rejects multi-statement queries
 ✅ PASS: rejects access to restricted tables
 ✅ PASS: [Regression] Composite Performance Queries
 ✅ PASS: [Regression] Account Asset Values
 ✅ PASS: [Regression] Benchmark Comparisons

📊 Test Summary: 9 passed, 0 failed.
```

### CI Pipeline

Every push to `main` and all pull requests run via **GitHub Actions** (`.github/workflows/ci.yml`):

1. Checkout + Install dependencies
2. Run full test suite (`npm test`)
3. Validate environment configuration

---

## 🐳 Docker Deployment

### Single Command Startup (Full Stack)

```bash
docker-compose up --build -d
```

**Services:**
| Service | Port | Description |
|---|---|---|
| `api` | 3001 | Node.js Express backend |
| `mongo` | 27017 | MongoDB instance |

### Manual Docker Build

```bash
cd backend
docker build -t financial-sql-api .
docker run -p 3001:3001 --env-file .env financial-sql-api
```

**Health Check:**
```bash
curl http://localhost:3001/api/chats
# → {"success": false, "error": "Authentication required..."}  ← Expected (proves API is running)
```

---

## 🧠 Database Schema

```sql
-- 1. CompositePerformance — portfolio performance by strategy
CREATE TABLE CompositePerformance (
  CompositeID      INT PRIMARY KEY,
  CompositeName    NVARCHAR(100),     -- Strategy name
  YTDReturn        DECIMAL(5,2),      -- Year-to-date return (%)
  OneYearReturn    DECIMAL(5,2),      -- 1-year trailing return (%)
  ThreeYearReturn  DECIMAL(5,2),      -- 3-year annualized return (%)
  AsOfDate         DATE,              -- Performance measurement date
  BenchmarkID      INT FOREIGN KEY REFERENCES Benchmark(BenchmarkID)
);

-- 2. Account — individual client accounts
CREATE TABLE Account (
  AccountID     INT PRIMARY KEY,
  AccountName   NVARCHAR(100),
  CompositeID   INT FOREIGN KEY REFERENCES CompositePerformance(CompositeID),
  MarketValue   DECIMAL(18,2),        -- Current AUM in USD
  InceptionDate DATE                  -- Account creation date
);

-- 3. Benchmark — benchmark indices
CREATE TABLE Benchmark (
  BenchmarkID     INT PRIMARY KEY,
  BenchmarkName   NVARCHAR(100),      -- e.g. "S&P 500 Index"
  BenchmarkReturn DECIMAL(5,2)        -- Benchmark return (%)
);
```

**Sample Analytical Questions Supported:**
```sql
-- Active return (alpha) per composite
SELECT cp.CompositeName,
       ROUND(cp.YTDReturn - b.BenchmarkReturn, 2) AS ActiveReturn
FROM CompositePerformance cp JOIN Benchmark b ON cp.BenchmarkID = b.BenchmarkID
ORDER BY ActiveReturn DESC;

-- AUM-weighted composite return
SELECT cp.CompositeName,
       SUM(a.MarketValue * cp.YTDReturn) / NULLIF(SUM(a.MarketValue), 0) AS WeightedReturn,
       SUM(a.MarketValue) AS TotalAUM
FROM CompositePerformance cp JOIN Account a ON a.CompositeID = cp.CompositeID
GROUP BY cp.CompositeName;

-- Portfolio inception age
SELECT AccountName, MarketValue,
       DATEDIFF(year, InceptionDate, GETDATE()) AS AgeYears
FROM Account ORDER BY InceptionDate ASC;
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/your-username/text-to-sql-project.git

# 3. Create a feature branch
git checkout -b feature/your-feature-name

# 4. Make your changes and run tests
cd backend && npm test

# 5. Commit with a clear message
git commit -m "feat: add your feature description"

# 6. Push and open a Pull Request
git push origin feature/your-feature-name
```

**Guidelines:**
- All new SQL-related code must pass the AST validation test suite
- Do not bypass the security sandbox or RBAC engine
- Follow existing ESM import conventions
- Add tests for new features in `backend/tests/`

---

## 📁 Additional Documentation

| Document | Description |
|---|---|
| [`backend/docs/MCP_INTEGRATION_GUIDE.md`](backend/docs/MCP_INTEGRATION_GUIDE.md) | MCP setup for Claude Desktop, Cursor, and remote agents |
| [`backend/docs/VAULT_SECRETS_GUIDE.md`](backend/docs/VAULT_SECRETS_GUIDE.md) | Azure Key Vault production secrets migration guide |

---

## 📄 License

This project is licensed under the **ISC License** — see the [LICENSE](LICENSE) file for full details.

---

<div align="center">

⭐ Star this repository if you found it useful!

</div>
