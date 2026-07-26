// Run with: node validateSql.test.js
import assert from "node:assert";
import { validateAndSanitizeSql, SqlValidationError } from "./validateSql.js";

const cases = [
  // --- should PASS -----------------------------------------------------
  { label: "simple valid select", sql: "SELECT TOP 5 CompositeName, YTDReturn FROM CompositePerformance ORDER BY YTDReturn DESC", expectOk: true },
  {
    label: "valid join across allowed tables",
    sql: `SELECT TOP 10 a.AccountName, c.CompositeName FROM Account a
          JOIN CompositePerformance c ON a.CompositeID = c.CompositeID`,
    expectOk: true,
  },
  { label: "valid aggregate function", sql: "SELECT TOP 5 CompositeName, AVG(YTDReturn) AS AvgReturn FROM CompositePerformance GROUP BY CompositeName", expectOk: true },

  // --- should FAIL: write/DDL --------------------------------------------
  { label: "DROP TABLE", sql: "DROP TABLE Account", expectOk: false, expectCode: "NOT_SELECT" },
  { label: "DELETE", sql: "DELETE FROM Account WHERE AccountID = 1", expectOk: false, expectCode: "NOT_SELECT" },
  { label: "UPDATE", sql: "UPDATE Account SET MarketValue = 0", expectOk: false, expectCode: "NOT_SELECT" },
  { label: "INSERT", sql: "INSERT INTO Account (AccountName) VALUES ('x')", expectOk: false, expectCode: "NOT_SELECT" },

  // --- should FAIL: stacked statements -------------------------------------
  { label: "stacked statement via semicolon", sql: "SELECT TOP 5 * FROM Account; DROP TABLE Account;", expectOk: false },

  // --- should FAIL: out-of-schema table -------------------------------------
  { label: "table not in schema", sql: "SELECT TOP 5 Username, PasswordHash FROM Users", expectOk: false, expectCode: "TABLE_NOT_ALLOWED" },

  // --- should FAIL: SELECT * ------------------------------------------------
  { label: "select star", sql: "SELECT TOP 5 * FROM Account", expectOk: false, expectCode: "SELECT_STAR" },

  // --- should FAIL: smuggled system proc ------------------------------------
  { label: "xp_cmdshell smuggled as a function call", sql: "SELECT TOP 1 xp_cmdshell('whoami') FROM Account", expectOk: false },
  { label: "OPENROWSET exfiltration attempt", sql: "SELECT TOP 1 * FROM OPENROWSET('SQLNCLI','...','SELECT 1')", expectOk: false },

  // --- should FAIL: non-SQL text leaking through -----------------------------
  { label: "garbage / non-SQL text", sql: "Sure! Here's the query you asked for: SELECT * FROM Account", expectOk: false },
];

let passed = 0;
for (const { label, sql, expectOk, expectCode } of cases) {
  try {
    const result = validateAndSanitizeSql(sql);
    if (expectOk) {
      console.log(`✓ ${label}`);
      passed++;
    } else {
      console.error(`✗ ${label} — expected rejection, but it passed: ${result.sql}`);
    }
  } catch (err) {
    assert(err instanceof SqlValidationError, `${label} threw a non-SqlValidationError: ${err.message}`);
    if (!expectOk) {
      if (expectCode) assert.strictEqual(err.code, expectCode, `${label} — expected code ${expectCode}, got ${err.code}`);
      console.log(`✓ ${label} (blocked: ${err.code})`);
      passed++;
    } else {
      console.error(`✗ ${label} — expected to pass, was blocked: ${err.code} ${err.message}`);
    }
  }
}

console.log(`\n${passed}/${cases.length} passed`);
process.exit(passed === cases.length ? 0 : 1);
