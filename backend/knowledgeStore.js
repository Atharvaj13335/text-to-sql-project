// ============================================================================
// Knowledge Base & RAG Retrieval Engine for Text-to-SQL
// Stores domain knowledge, schema documentation, KPI formulas, and sample SQL patterns.
// ============================================================================

export const KNOWLEDGE_BASE = [
  {
    id: "schema_composite_performance",
    category: "Schema & Table Definition",
    title: "CompositePerformance Table Schema",
    keywords: ["composite", "performance", "ytd", "return", "1year", "3year", "asofdate", "returns", "portfolio"],
    content: `Table: CompositePerformance
Description: Tracks historical and YTD performance returns for investment composite portfolios.
Columns:
  - CompositeID (int, PK): Unique identifier for the composite portfolio.
  - CompositeName (nvarchar): Name of investment composite (e.g., 'US Large Cap Growth Composite', 'Global Equity Opportunities', 'Tech Innovation Fund').
  - YTDReturn (decimal): Year-to-date performance percentage (e.g. 16.80 means 16.8%).
  - OneYearReturn (decimal): 1-Year annualized return percentage.
  - ThreeYearReturn (decimal): 3-Year annualized return percentage.
  - AsOfDate (date): Valuation date (e.g., '2026-06-30').
  - BenchmarkID (int, FK -> Benchmark.BenchmarkID): Associated benchmark index ID.`,
  },
  {
    id: "schema_account",
    category: "Schema & Table Definition",
    title: "Account Table Schema",
    keywords: ["account", "accounts", "marketvalue", "value", "inception", "date", "client", "assets", "aum"],
    content: `Table: Account
Description: Stores individual investor accounts belonging to composites, including market asset values.
Columns:
  - AccountID (int, PK): Unique account identifier.
  - AccountName (nvarchar): Client account name (e.g., 'Alpha Tech Ventures Account', 'Fidelity Partner Account B').
  - CompositeID (int, FK -> CompositePerformance.CompositeID): Link to parent composite.
  - MarketValue (decimal): Total account market value in USD ($).
  - InceptionDate (date): Account creation/opening date.`,
  },
  {
    id: "schema_benchmark",
    category: "Schema & Table Definition",
    title: "Benchmark Table Schema",
    keywords: ["benchmark", "benchmarks", "index", "indices", "sp500", "nasdaq", "msci", "russell", "bloomberg"],
    content: `Table: Benchmark
Description: Reference financial market indices for performance benchmarking.
Columns:
  - BenchmarkID (int, PK): Unique benchmark identifier.
  - BenchmarkName (nvarchar): Benchmark index name (e.g., 'S&P 500 Index', 'Nasdaq 100 Index', 'MSCI World Index').
  - BenchmarkReturn (decimal): Reference return percentage of the index.`,
  },
  {
    id: "kpi_formulas",
    category: "Domain Calculations & Rules",
    title: "Financial Return & AUM Definitions",
    keywords: ["ytd", "formula", "return", "aum", "total market value", "average", "top", "performance"],
    content: `Domain Business Rules:
1. Total Assets Under Management (AUM) = SUM(Account.MarketValue).
2. Average Account Value = AVG(Account.MarketValue).
3. Best Performing Composite = SELECT TOP 1 CompositeName, YTDReturn FROM CompositePerformance ORDER BY YTDReturn DESC.
4. Composite Return vs Benchmark = Join CompositePerformance c ON c.BenchmarkID = b.BenchmarkID to compare YTDReturn against BenchmarkReturn.`,
  },
  {
    id: "sql_patterns_aggregation",
    category: "SQL Best Practices",
    title: "Aggregations and Joins T-SQL Patterns",
    keywords: ["sql", "join", "group by", "sum", "avg", "top", "select", "query", "pattern"],
    content: `T-SQL Best Practices for Financial Queries:
- Always use TOP 200 to cap result size.
- For total market value by composite:
  SELECT TOP 200 c.CompositeName, SUM(a.MarketValue) AS TotalMarketValue, COUNT(a.AccountID) AS AccountCount
  FROM Account a
  JOIN CompositePerformance c ON a.CompositeID = c.CompositeID
  GROUP BY c.CompositeName
  ORDER BY TotalMarketValue DESC;
- For composite vs benchmark:
  SELECT TOP 200 c.CompositeName, c.YTDReturn, b.BenchmarkName, b.BenchmarkReturn, (c.YTDReturn - b.BenchmarkReturn) AS Alpha
  FROM CompositePerformance c
  JOIN Benchmark b ON c.BenchmarkID = b.BenchmarkID;`,
  },
];

/**
 * Retrieve top-K relevant knowledge snippets using keyword similarity and term frequency scoring.
 */
export function retrieveRelevantKnowledge(query, topK = 3) {
  if (!query || typeof query !== "string") return KNOWLEDGE_BASE.slice(0, topK);

  const cleanQuery = query.toLowerCase().replace(/[^\w\s]/g, "");
  const words = cleanQuery.split(/\s+/).filter((w) => w.length > 2);

  const scored = KNOWLEDGE_BASE.map((doc) => {
    let score = 0;

    // Check keyword matches
    words.forEach((word) => {
      doc.keywords.forEach((kw) => {
        if (kw.includes(word) || word.includes(kw)) {
          score += 3;
        }
      });

      // Check title and content matches
      if (doc.title.toLowerCase().includes(word)) score += 2;
      if (doc.content.toLowerCase().includes(word)) score += 1;
    });

    return { ...doc, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // If no specific match found, return top default schema docs
  const topDocs = scored.filter((d) => d.score > 0);
  if (topDocs.length === 0) {
    return KNOWLEDGE_BASE.slice(0, topK);
  }

  return topDocs.slice(0, topK);
}
