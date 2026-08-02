import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { validateAndSanitizeSql } from "../src/security/validateSql.js";

const allowedTables = ["CompositePerformance", "Account", "Benchmark"];

const REGRESSION_TEST_QUERIES = [
  {
    category: "Composite Performance Queries",
    input: "SELECT CompositeName, YTDReturn FROM CompositePerformance ORDER BY YTDReturn DESC",
    expectedTables: ["CompositePerformance"],
  },
  {
    category: "Account Asset Values",
    input: "SELECT AccountName, MarketValue FROM Account WHERE MarketValue > 10000000",
    expectedTables: ["Account"],
  },
  {
    category: "Benchmark Comparisons",
    input: "SELECT c.CompositeName, c.YTDReturn, b.BenchmarkName, b.BenchmarkReturn FROM CompositePerformance c JOIN Benchmark b ON c.BenchmarkID = b.BenchmarkID",
    expectedTables: ["CompositePerformance", "Benchmark"],
  },
];

describe("LLM Prompt & AST Safety Regression Suite", () => {
  REGRESSION_TEST_QUERIES.forEach(({ category, input, expectedTables }) => {
    test(`[${category}] validates safety and table dependencies`, () => {
      const result = validateAndSanitizeSql(input, { allowedTables, maxRows: 200 });

      assert.ok(result.sql);
      assert.match(result.sql, /SELECT TOP 200/i);
      expectedTables.forEach((table) => {
        assert.ok(result.tablesUsed.includes(table));
      });
    });
  });
});
