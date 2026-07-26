# Text-to-SQL Financial Data Assistant

An interactive AI-powered financial reporting assistant that translates natural language questions into safe, validated T-SQL queries. Features a dynamic particle background, interactive query editing, multi-session chat history, and MongoDB persistence.

## Key Features

- 💬 **Natural Language to SQL**: Converts plain-English financial questions into schema-aware T-SQL queries.
- ⚡ **Interactive Query Sandbox**: Edit T-SQL statements inline, run structural safety checks, and re-execute against SQL Server.
- 🗄️ **MongoDB Chat Persistence**: Saves conversation threads to MongoDB with automatic in-memory fallback.
- 📜 **Conversation History Sidebar**: Claude-style floating panel for creating, switching, and deleting chat sessions.
- 📊 **Dynamic Data Visualizations**: Renders results in interactive data tables or charts based on result shape.
- 🌌 **Particle Physics Aesthetics**: Viewport-wide interactive starfield with glassmorphism UI overlay.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Recharts, Lucide Icons
- **Backend**: Node.js, Express, Anthropic Claude SDK, Mongoose, MSSQL, `node-sql-parser`

## Setup & Running

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Access the application at `http://localhost:5173`.
