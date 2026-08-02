export function getMockQueryData(tablesUsed, sql) {
  if (tablesUsed.includes("CompositePerformance") && tablesUsed.includes("Account")) {
    return {
      columns: ["CompositeName", "TotalMarketValue", "AccountCount"],
      rows: [
        ["US Large Cap Growth Composite", "45250000.00", "12"],
        ["Global Equity Opportunities", "28100000.00", "8"],
        ["Tech Innovation Fund", "19400000.00", "5"],
      ],
    };
  }

  if (tablesUsed.includes("Account")) {
    return {
      columns: ["AccountID", "AccountName", "MarketValue", "InceptionDate"],
      rows: [
        ["101", "Alpha Tech Ventures Account", "12500000.00", "2021-03-15"],
        ["102", "Fidelity Partner Account B", "8750000.00", "2020-11-01"],
        ["103", "Horizon Global Wealth Fund", "15400000.00", "2019-06-20"],
        ["104", "Vanguard Institutional Trust", "24000000.00", "2018-01-10"],
      ],
    };
  }

  if (tablesUsed.includes("Benchmark")) {
    return {
      columns: ["BenchmarkID", "BenchmarkName", "BenchmarkReturn"],
      rows: [
        ["1", "S&P 500 Index", "14.50"],
        ["2", "Nasdaq 100 Index", "18.20"],
        ["3", "MSCI World Index", "11.80"],
      ],
    };
  }

  return {
    columns: ["CompositeID", "CompositeName", "YTDReturn", "OneYearReturn", "AsOfDate"],
    rows: [
      ["1", "US Large Cap Growth Composite", "16.80", "22.40", "2026-06-30"],
      ["2", "Global Equity Opportunities", "12.30", "15.90", "2026-06-30"],
      ["3", "Tech Innovation Fund", "24.10", "31.50", "2026-06-30"],
    ],
  };
}
