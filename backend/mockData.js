// ============================================================================
// Smart In-Memory SQL Query Evaluator for Mock Datasets
// Parses basic T-SQL SELECT statements (WHERE, JOIN, ORDER BY, TOP N, SELECT columns)
// so query results accurately filter down to specific accounts/composites.
// ============================================================================

export const MOCK_BENCHMARKS = [
  { BenchmarkID: 1, BenchmarkName: "S&P 500 Index", BenchmarkReturn: 14.50 },
  { BenchmarkID: 2, BenchmarkName: "MSCI World Index", BenchmarkReturn: 11.20 },
  { BenchmarkID: 3, BenchmarkName: "Bloomberg US Aggregate Bond", BenchmarkReturn: 3.80 },
  { BenchmarkID: 4, BenchmarkName: "Nasdaq 100 Index", BenchmarkReturn: 18.90 },
  { BenchmarkID: 5, BenchmarkName: "Russell 2000 Small-Cap", BenchmarkReturn: 8.40 },
];

export const MOCK_COMPOSITES = [
  { CompositeID: 1, CompositeName: "US Large Cap Growth Composite", YTDReturn: 16.80, OneYearReturn: 21.40, ThreeYearReturn: 14.10, AsOfDate: "2026-06-30", BenchmarkID: 1 },
  { CompositeID: 2, CompositeName: "Global Equity Opportunities", YTDReturn: 12.30, OneYearReturn: 15.60, ThreeYearReturn: 10.80, AsOfDate: "2026-06-30", BenchmarkID: 2 },
  { CompositeID: 3, CompositeName: "US Core Fixed Income Composite", YTDReturn: 4.10, OneYearReturn: 5.20, ThreeYearReturn: 3.90, AsOfDate: "2026-06-30", BenchmarkID: 3 },
  { CompositeID: 4, CompositeName: "Tech Innovation Fund", YTDReturn: 22.50, OneYearReturn: 28.70, ThreeYearReturn: 19.30, AsOfDate: "2026-06-30", BenchmarkID: 4 },
  { CompositeID: 5, CompositeName: "Small Cap Dynamic Value", YTDReturn: 9.60, OneYearReturn: 11.80, ThreeYearReturn: 8.50, AsOfDate: "2026-06-30", BenchmarkID: 5 },
];

export const MOCK_ACCOUNTS = [
  { AccountID: 101, AccountName: "Alpha Tech Ventures Account", CompositeID: 4, MarketValue: 12500000.00, InceptionDate: "2021-03-15" },
  { AccountID: 102, AccountName: "Apex Pension Trust Account A", CompositeID: 1, MarketValue: 45000000.00, InceptionDate: "2019-01-10" },
  { AccountID: 103, AccountName: "Beacon Endowment Fund", CompositeID: 2, MarketValue: 28750000.00, InceptionDate: "2020-07-22" },
  { AccountID: 104, AccountName: "Cedar Creek Fixed Income Account", CompositeID: 3, MarketValue: 18200000.00, InceptionDate: "2018-11-05" },
  { AccountID: 105, AccountName: "Delta Global Growth Portfolio", CompositeID: 2, MarketValue: 34100000.00, InceptionDate: "2022-02-14" },
  { AccountID: 106, AccountName: "Evergreen Tech Growth Account", CompositeID: 4, MarketValue: 8900000.00, InceptionDate: "2023-05-01" },
  { AccountID: 107, AccountName: "Fidelity Partner Account B", CompositeID: 1, MarketValue: 52300000.00, InceptionDate: "2017-09-30" },
  { AccountID: 108, AccountName: "Horizon Small-Cap Growth", CompositeID: 5, MarketValue: 14600000.00, InceptionDate: "2022-10-18" },
];

export function getMockQueryData(tablesUsed = [], sqlString = "") {
  if (!sqlString) return getDefaultMock(tablesUsed);

  try {
    // 1. Determine base dataset & joins
    let rawRows = [];

    const isJoin = /JOIN/i.test(sqlString);
    if (isJoin) {
      // Build joined dataset Account + CompositePerformance + Benchmark
      rawRows = MOCK_ACCOUNTS.map((acc) => {
        const comp = MOCK_COMPOSITES.find((c) => c.CompositeID === acc.CompositeID) || {};
        const bench = MOCK_BENCHMARKS.find((b) => b.BenchmarkID === comp.BenchmarkID) || {};
        return { ...acc, ...comp, ...bench };
      });
    } else if (tablesUsed.includes("Account")) {
      rawRows = MOCK_ACCOUNTS.map((a) => ({ ...a }));
    } else if (tablesUsed.includes("CompositePerformance")) {
      rawRows = MOCK_COMPOSITES.map((c) => ({ ...c }));
    } else if (tablesUsed.includes("Benchmark")) {
      rawRows = MOCK_BENCHMARKS.map((b) => ({ ...b }));
    } else {
      rawRows = MOCK_ACCOUNTS.map((a) => ({ ...a }));
    }

    let filtered = [...rawRows];

    // 2. WHERE Clause Filter (multi-condition AND evaluation)
    const whereMatch = sqlString.match(/WHERE\s+([\s\S]+?)(?:ORDER\s+BY|GROUP\s+BY|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      const conditions = whereClause.split(/\s+AND\s+/i);

      filtered = filtered.filter((row) => {
        return conditions.every((cond) => {
          // Check string equality / LIKE
          const strMatch = cond.match(/([a-zA-Z0-9_\.]+)\s*(=|LIKE)\s*'([^']+)'/i);
          if (strMatch) {
            const [, rawCol, op, val] = strMatch;
            const col = getColNameWithoutAlias(rawCol);
            const rowVal = String(row[col] ?? "").toLowerCase();
            const targetVal = val.toLowerCase().replace(/%/g, "");
            if (op.toUpperCase() === "LIKE") {
              return rowVal.includes(targetVal);
            }
            return rowVal === targetVal;
          }

          // Check numeric comparison
          const numMatch = cond.match(/([a-zA-Z0-9_\.]+)\s*(>|<|>=|<=|=)\s*(\d+(?:\.\d+)?)/i);
          if (numMatch) {
            const [, rawCol, op, numStr] = numMatch;
            const col = getColNameWithoutAlias(rawCol);
            const val = parseFloat(row[col]);
            const targetNum = parseFloat(numStr);
            if (isNaN(val)) return true;
            if (op === ">") return val > targetNum;
            if (op === "<") return val < targetNum;
            if (op === ">=") return val >= targetNum;
            if (op === "<=") return val <= targetNum;
            if (op === "=") return val === targetNum;
          }

          return true;
        });
      });
    }

    // 3. ORDER BY Clause
    const orderMatch = sqlString.match(/ORDER\s+BY\s+([a-zA-Z0-9_\.]+)(?:\s+(ASC|DESC))?/i);
    if (orderMatch) {
      const col = getColNameWithoutAlias(orderMatch[1]);
      const dir = (orderMatch[2] || "ASC").toUpperCase();
      filtered.sort((a, b) => {
        let valA = a[col] ?? 0;
        let valB = b[col] ?? 0;
        if (typeof valA === "string" && !isNaN(Number(valA))) valA = Number(valA);
        if (typeof valB === "string" && !isNaN(Number(valB))) valB = Number(valB);

        if (valA < valB) return dir === "ASC" ? -1 : 1;
        if (valA > valB) return dir === "ASC" ? 1 : -1;
        return 0;
      });
    }

    // 4. TOP N Limit Clause
    const topMatch = sqlString.match(/SELECT\s+TOP\s+(\d+)/i);
    if (topMatch) {
      const limit = parseInt(topMatch[1], 10);
      if (limit > 0 && limit < filtered.length) {
        filtered = filtered.slice(0, limit);
      }
    }

    // 5. Select Column Projection
    const selectMatch = sqlString.match(/SELECT\s+(?:TOP\s+\d+\s+)?([\s\S]+?)\s+FROM/i);
    let targetColumns = [];
    if (selectMatch) {
      const colsPart = selectMatch[1];
      const rawCols = colsPart.split(",").map((c) => c.trim());

      rawCols.forEach((c) => {
        // Handle alias: e.g. SUM(MarketValue) AS TotalMarketValue or c.CompositeName AS Name
        const aliasMatch = c.match(/(?:AS\s+)?([a-zA-Z0-9_]+)$/i);
        const colName = getColNameWithoutAlias(c);

        if (aliasMatch) {
          targetColumns.push(aliasMatch[1]);
        } else if (colName && colName !== "*") {
          targetColumns.push(colName);
        }
      });
    }

    if (filtered.length === 0) return { columns: targetColumns.length > 0 ? targetColumns : ["Info"], rows: [] };

    // Format output columns & rows
    const columns = targetColumns.length > 0 ? targetColumns : Object.keys(filtered[0]);
    const rows = filtered.map((item) => {
      if (targetColumns.length > 0) {
        return targetColumns.map((col) => {
          const val = item[col] ?? item[getColNameWithoutAlias(col)] ?? "N/A";
          return String(val);
        });
      }
      return Object.values(item).map(String);
    });

    return { columns, rows };
  } catch (err) {
    console.warn("Smart mock SQL parsing fallback:", err.message);
    return getDefaultMock(tablesUsed);
  }
}

function getColNameWithoutAlias(colStr = "") {
  const cleaned = colStr.replace(/^(?:SUM|AVG|COUNT|MIN|MAX)\(([^)]+)\)/i, "$1").trim();
  const parts = cleaned.split(".");
  return parts[parts.length - 1].trim();
}

function getDefaultMock(tablesUsed) {
  let dataset = MOCK_ACCOUNTS;
  if (tablesUsed.includes("CompositePerformance")) dataset = MOCK_COMPOSITES;
  else if (tablesUsed.includes("Benchmark")) dataset = MOCK_BENCHMARKS;

  const columns = Object.keys(dataset[0]);
  const rows = dataset.map((item) => Object.values(item).map(String));
  return { columns, rows };
}
