# Natural Language Data Retrieval Engine (Text-to-SQL)

An interactive chatbot that answers natural-language questions about financial
performance and composites by generating schema-aware SQL Server queries with
Claude, validating them structurally, and running them read-only.

## Architecture

```
React chat UI  →  Node.js/Express API  →  Claude (generates SQL)
                         │                         │
                         │            AST validator (blocks unsafe SQL)
                         │                         │
                         └──────────→  SQL Server (read-only login)
```

## Project structure

```
frontend/            React + Vite chat UI — dark space theme
  src/
    components/
      ChatInterface.jsx  chat window, results table, chart toggle, SQL disclosure
      ParticleField.jsx  interactive canvas background — particles scatter on cursor hover, spring back to rest
    App.jsx
    main.jsx
  tailwind.config.js  dark palette tokens (space/panel/accent/gold/aqua) + drift/glow-pulse keyframes
  vite.config.js      dev proxy: /api → localhost:3001

backend/              Node.js/Express API
  server.js           POST /api/ask — the whole request pipeline
  schema.js           schema description fed to Claude + table allow-list
  validateSql.js       AST-based SQL validator (throws SqlValidationError)
  validateSql.test.js  adversarial test suite for the validator
  db.js                SQL Server connection pool
  sql/schema.sql        DDL + seed data + read-only login setup
```

## Setup

### 1. Database

Run `backend/sql/schema.sql` against a fresh SQL Server database (SQL Server
Express locally, or Azure SQL free tier both work). It creates three sample
tables, seeds them with fake financial data, and creates the read-only login
the backend connects as. **Change the password in that script before running
it anywhere real.**

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in ANTHROPIC_API_KEY and DB_* values
npm run dev
```

Runs on `http://localhost:3001`. Verify it's up: `curl http://localhost:3001/api/health`.

Run the validator's adversarial test suite any time you change the schema or
validation rules:

```bash
npm test
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`, with `/api/*` requests proxied to the
backend automatically (see `vite.config.js`) — no CORS setup needed in dev.

## Security model (defense in depth)

1. **Read-only DB login** (`sql/schema.sql`) — the real backstop. Even a
   total validator bypass can't write data, because the SQL Server user has
   no `INSERT`/`UPDATE`/`DELETE`/`ALTER` grants.
2. **AST-based validator** (`validateSql.js`) — parses generated SQL into a
   syntax tree and checks structure: exactly one `SELECT`, only allow-listed
   tables, no `SELECT *`, only a safe function allow-list, a capped row limit.
3. **Prompt instructions** — the weakest layer, shapes what the model is
   inclined to generate, never relied on alone.

## What's mocked vs. real

Everything here is real and runnable except the sample data, which is
fictional (see `sql/schema.sql`). Point `schema.js` and `sql/schema.sql` at
your actual composite/performance tables to use this against real data.

## Possible next steps

- Streaming responses (SSE) instead of waiting for the full query to finish
- Conversation memory, so follow-up questions like "now break that down by
  quarter" work without repeating context
- Auth in front of `/api/ask` so only authorized analysts can query
- A second numeric-series chart mode for multi-series comparisons
