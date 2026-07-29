
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
  let dataset = [];

  if (tablesUsed.includes("Account")) {
    dataset = MOCK_ACCOUNTS;
  } else if (tablesUsed.includes("CompositePerformance")) {
    dataset = MOCK_COMPOSITES;
  } else if (tablesUsed.includes("Benchmark")) {
    dataset = MOCK_BENCHMARKS;
  } else {
    dataset = MOCK_ACCOUNTS;
  }

  if (dataset.length === 0) return { columns: [], rows: [] };

  const columns = Object.keys(dataset[0]);
  const rows = dataset.map((item) => Object.values(item).map(String));

  return { columns, rows };
}
