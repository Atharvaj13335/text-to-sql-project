import pkg from "node-sql-parser";
const { Parser } = pkg;

const parser = new Parser();

export class SqlValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SqlValidationError";
  }
}

const DEFAULT_ALLOWED_TABLES = ["CompositePerformance", "Account", "Benchmark"];
const DEFAULT_MAX_ROWS = 200;

export function validateAndSanitizeSql(sqlInput, options = {}) {
  const allowedTables = options.allowedTables || DEFAULT_ALLOWED_TABLES;
  const maxRows = options.maxRows || DEFAULT_MAX_ROWS;

  if (!sqlInput || typeof sqlInput !== "string") {
    throw new SqlValidationError("SQL input must be a non-empty string.");
  }

  let cleaned = sqlInput
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .trim();

  if (cleaned.endsWith(";")) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|MERGE)\b/i.test(cleaned)) {
    throw new SqlValidationError("Security Violation: Only SELECT statements are permitted.");
  }

  let ast;
  try {
    ast = parser.astify(cleaned, { database: "TransactSQL" });
  } catch (err) {
    try {
      ast = parser.astify(cleaned, { database: "MySQL" });
    } catch (err2) {
      throw new SqlValidationError(`SQL Syntax Error: Unable to parse query AST. (${err.message})`);
    }
  }

  const statements = Array.isArray(ast) ? ast : [ast];

  if (statements.length > 1) {
    throw new SqlValidationError("Security Violation: Multi-statement queries are forbidden.");
  }

  const statement = statements[0];

  if (!statement || statement.type !== "select") {
    throw new SqlValidationError(`Security Violation: Query type '${statement?.type || "unknown"}' is not allowed. Only SELECT queries are permitted.`);
  }

  const tablesUsed = extractTablesFromAst(statement);
  const normalizedAllowed = allowedTables.map((t) => t.toLowerCase());

  for (const table of tablesUsed) {
    if (!normalizedAllowed.includes(table.toLowerCase())) {
      throw new SqlValidationError(`Security Violation: Access to table '${table}' is restricted. Permitted tables: [${allowedTables.join(", ")}].`);
    }
  }

  const sanitizedSql = enforceTopLimit(cleaned, maxRows);

  return {
    sql: sanitizedSql,
    tablesUsed,
    ast: statement,
  };
}

function extractTablesFromAst(astNode, tables = new Set()) {
  if (!astNode || typeof astNode !== "object") return Array.from(tables);

  if (astNode.from && Array.isArray(astNode.from)) {
    for (const item of astNode.from) {
      if (item.table) {
        tables.add(item.table);
      }
      if (item.expr && item.expr.ast) {
        extractTablesFromAst(item.expr.ast, tables);
      }
    }
  }

  return Array.from(tables);
}

function enforceTopLimit(sql, maxRows) {
  if (/\bTOP\s+\d+/i.test(sql)) {
    return sql.replace(/\bTOP\s+(\d+)/i, (match, count) => {
      const num = parseInt(count, 10);
      return `TOP ${Math.min(num, maxRows)}`;
    });
  }

  return sql.replace(/^SELECT\b/i, `SELECT TOP ${maxRows}`);
}
