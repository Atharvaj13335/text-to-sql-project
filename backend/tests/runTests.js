import { validateAndSanitizeSql } from "../src/security/validateSql.js";

const allowedTables = ["CompositePerformance", "Account", "Benchmark"];

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function runTest(name, fn) {
  try {
    fn();
    console.log(` ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(` ❌ FAIL: ${name} -> ${err.message}`);
    failed++;
  }
}

console.log("\n🧪 Running Financial Text-to-SQL Test Suite...\n");

// 1. AST Validation Tests
runTest("accepts valid SELECT statement and caps TOP 200", () => {
  const query = "SELECT CompositeName, YTDReturn FROM CompositePerformance WHERE YTDReturn > 10.0";
  const result = validateAndSanitizeSql(query, { allowedTables, maxRows: 200 });
  assert(result.sql.includes("TOP 200"), "Expected SELECT TOP 200");
  assert(result.tablesUsed.includes("CompositePerformance"), "Expected table CompositePerformance");
});

runTest("respects existing TOP clause if below max limit", () => {
  const query = "SELECT TOP 50 AccountName, MarketValue FROM Account";
  const result = validateAndSanitizeSql(query, { allowedTables, maxRows: 200 });
  assert(result.sql.includes("TOP 50"), "Expected SELECT TOP 50");
});

runTest("downscales TOP clause if above max limit", () => {
  const query = "SELECT TOP 1000 AccountName, MarketValue FROM Account";
  const result = validateAndSanitizeSql(query, { allowedTables, maxRows: 200 });
  assert(result.sql.includes("TOP 200"), "Expected SELECT TOP 200");
});

runTest("rejects non-SELECT statements (INSERT/DELETE/DROP)", () => {
  let threw = false;
  try {
    validateAndSanitizeSql("DELETE FROM CompositePerformance WHERE CompositeID = 1", { allowedTables });
  } catch (e) {
    threw = true;
  }
  assert(threw, "Expected error on DELETE statement");
});

runTest("rejects multi-statement queries", () => {
  let threw = false;
  try {
    validateAndSanitizeSql("SELECT * FROM Account; DELETE FROM Account;", { allowedTables });
  } catch (e) {
    threw = true;
  }
  assert(threw, "Expected error on multi-statement query");
});

runTest("rejects access to restricted tables", () => {
  let threw = false;
  try {
    validateAndSanitizeSql("SELECT * FROM RestrictedUserData", { allowedTables });
  } catch (e) {
    threw = true;
  }
  assert(threw, "Expected error on restricted table access");
});

// 2. LLM Regression Queries
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

REGRESSION_TEST_QUERIES.forEach(({ category, input, expectedTables }) => {
  runTest(`[Regression] ${category}`, () => {
    const result = validateAndSanitizeSql(input, { allowedTables, maxRows: 200 });
    assert(result.sql.includes("TOP 200"), "Expected TOP 200");
    expectedTables.forEach((table) => {
      assert(result.tablesUsed.includes(table), `Expected table ${table}`);
    });
  });
});

console.log(`\n📊 Test Summary: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
