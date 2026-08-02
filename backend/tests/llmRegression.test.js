import { validateAndSanitizeSql } from "../validateSql.js";
import { SCHEMA_TABLES } from "../schema.js";

const REGRESSION_TEST_CASES = [
  {
    name: "Account listing",
    question: "Show top 5 accounts by market value",
    testSql: "SELECT TOP 5 AccountName, MarketValue FROM Account ORDER BY MarketValue DESC",
    expectedKeywords: ["TOP", "AccountName", "MarketValue", "ORDER BY", "DESC"],
    expectedTable: "Account",
  },
  {
    name: "Composite YTD return",
    question: "List all composites with YTD return greater than 10%",
    testSql: "SELECT TOP 200 CompositeName, YTDReturn FROM CompositePerformance WHERE YTDReturn > 10",
    expectedKeywords: ["CompositeName", "YTDReturn", "WHERE"],
    expectedTable: "CompositePerformance",
  },
  {
    name: "Benchmark performance",
    question: "Show all benchmarks and their return",
    testSql: "SELECT TOP 200 BenchmarkName, BenchmarkReturn FROM Benchmark",
    expectedKeywords: ["BenchmarkName", "BenchmarkReturn"],
    expectedTable: "Benchmark",
  },
];

console.log("================================================");
console.log("🧪 RUNNING LLM & VALIDATOR REGRESSION TEST SUITE");
console.log("================================ failure =================\n");

let passed = 0;

for (const testCase of REGRESSION_TEST_CASES) {
  console.log(`Testing: "${testCase.question}"`);
  
  try {
    const { sql, tablesUsed } = validateAndSanitizeSql(testCase.testSql, {
      allowedTables: SCHEMA_TABLES,
      maxRows: 200,
    });
    
    const hasTable = tablesUsed.includes(testCase.expectedTable);
    const hasKeywords = testCase.expectedKeywords.every((kw) => sql.toUpperCase().includes(kw.toUpperCase()));

    if (hasTable && hasKeywords) {
      console.log(`   Result: PASSED ✅ (Table: ${tablesUsed.join(", ")})`);
      passed++;
    } else {
      console.log(`   Result: FAILED ❌ (Keywords missing)`);
    }
  } catch (err) {
    console.log(`   Result: FAILED ❌ (${err.message})`);
  }
}

console.log(`\nRegression Suite Completed: ${passed}/${REGRESSION_TEST_CASES.length} Passed.`);
if (passed !== REGRESSION_TEST_CASES.length) {
  process.exit(1);
}
