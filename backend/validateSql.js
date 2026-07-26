import pkg from "node-sql-parser";
import { SCHEMA_TABLES } from "./schema.js";

const { Parser } = pkg;
const parser = new Parser();
const DEFAULT_MAX_ROWS = 200;

export class SqlValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SqlValidationError";
    this.code = code; // machine-readable reason, useful for logs/metrics
  }
}

/**
 * Validate a model-generated SQL string against structural safety rules,
 * and return a sanitized version safe to execute.
 *
 * Throws SqlValidationError (never returns ok:false) so callers can use a
 * single try/catch and a clean instanceof check — see server.js.
 */
export function validateAndSanitizeSql(sql, { allowedTables = SCHEMA_TABLES, maxRows = DEFAULT_MAX_ROWS } = {}) {
  let ast;
  try {
    ast = parser.astify(sql, { database: "transactsql" });
  } catch (err) {
    throw new SqlValidationError("PARSE_ERROR", `Not valid SQL: ${err.message}`);
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1) {
    throw new SqlValidationError("MULTIPLE_STATEMENTS", "Multiple statements are not allowed.");
  }

  const stmt = statements[0];
  if (stmt.type !== "select") {
    throw new SqlValidationError("NOT_SELECT", `Only SELECT is allowed, got "${stmt.type}".`);
  }

  const allowedLower = new Set(allowedTables.map((t) => t.toLowerCase()));
  const tablesUsed = collectTables(stmt);
  for (const t of tablesUsed) {
    if (!allowedLower.has(t.toLowerCase())) {
      throw new SqlValidationError("TABLE_NOT_ALLOWED", `Table "${t}" is not in the allowed schema.`);
    }
  }

  const columnsUsed = collectColumns(stmt);
  if (columnsUsed.includes("*")) {
    throw new SqlValidationError("SELECT_STAR", "SELECT * is not allowed — list explicit columns.");
  }

  const SAFE_FUNCS = new Set(["sum", "avg", "count", "min", "max", "round", "cast", "convert"]);
  for (const fn of collectFunctionNames(stmt)) {
    if (!SAFE_FUNCS.has(fn.toLowerCase())) {
      throw new SqlValidationError("FUNCTION_NOT_ALLOWED", `Function "${fn}" is not allowed.`);
    }
  }

  const safeSql = enforceRowLimit(stmt, sql, maxRows);

  return { sql: safeSql, tablesUsed: [...new Set(tablesUsed)] };
}

// --- AST helpers -----------------------------------------------------------

function collectTables(stmt) {
  const out = [];
  (stmt.from || []).forEach((f) => {
    if (f.table) out.push(f.table);
    if (f.expr && f.expr.ast) out.push(...collectTables(f.expr.ast));
  });
  return out;
}

function collectColumns(stmt) {
  const out = [];
  (stmt.columns || []).forEach((c) => {
    if (c === "*" || c.expr?.column === "*") out.push("*");
    else if (c.expr?.column) out.push(c.expr.column);
  });
  return out;
}

function collectFunctionNames(stmt) {
  const out = [];
  (stmt.columns || []).forEach((c) => {
    if (c.expr?.type === "aggr_func" || c.expr?.type === "function") {
      const name = c.expr.name?.name?.[0]?.value || c.expr.name;
      if (name) out.push(String(name));
    }
  });
  return out;
}

function enforceRowLimit(stmt, originalSql, maxRows) {
  const requested = stmt.top?.value;
  if (!requested || requested > maxRows) {
    return originalSql.replace(/^\s*SELECT\s+(TOP\s+\d+\s+)?/i, `SELECT TOP ${maxRows} `);
  }
  return originalSql;
}
