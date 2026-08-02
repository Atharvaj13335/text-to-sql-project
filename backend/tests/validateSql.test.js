import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { validateAndSanitizeSql } from "../src/security/validateSql.js";

const allowedTables = ["CompositePerformance", "Account", "Benchmark"];

describe("SQL AST Security & Sanitization Validator", () => {
  test("accepts valid SELECT statement and caps TOP 200", () => {
    const query = "SELECT CompositeName, YTDReturn FROM CompositePerformance WHERE YTDReturn > 10.0";
    const result = validateAndSanitizeSql(query, { allowedTables, maxRows: 200 });

    assert.match(result.sql, /SELECT TOP 200/i);
    assert.ok(result.tablesUsed.includes("CompositePerformance"));
  });

  test("respects existing TOP clause if below max limit", () => {
    const query = "SELECT TOP 50 AccountName, MarketValue FROM Account";
    const result = validateAndSanitizeSql(query, { allowedTables, maxRows: 200 });

    assert.match(result.sql, /SELECT TOP 50/i);
  });

  test("downscales TOP clause if above max limit", () => {
    const query = "SELECT TOP 1000 AccountName, MarketValue FROM Account";
    const result = validateAndSanitizeSql(query, { allowedTables, maxRows: 200 });

    assert.match(result.sql, /SELECT TOP 200/i);
  });

  test("rejects non-SELECT statements (INSERT/DELETE/DROP)", () => {
    assert.throws(
      () => validateAndSanitizeSql("DELETE FROM CompositePerformance WHERE CompositeID = 1", { allowedTables }),
      /SELECT statements are permitted/i
    );

    assert.throws(
      () => validateAndSanitizeSql("DROP TABLE Account", { allowedTables }),
      /SELECT statements are permitted/i
    );
  });

  test("rejects multi-statement queries", () => {
    assert.throws(
      () => validateAndSanitizeSql("SELECT * FROM Account; DELETE FROM Account;", { allowedTables }),
      /SELECT statements are permitted|Multi-statement queries are forbidden/i
    );
  });

  test("rejects access to unallowed tables", () => {
    assert.throws(
      () => validateAndSanitizeSql("SELECT * FROM UsersSecrets", { allowedTables }),
      /Access to table 'UsersSecrets' is restricted/i
    );
  });
});
