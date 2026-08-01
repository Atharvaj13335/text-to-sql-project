// Keep this in sync with your real database. Generate it once with a script
// that reads INFORMATION_SCHEMA.COLUMNS, then hand-edit for clarity — the
// model does much better with short human descriptions than raw DDL.

// Plain array of allowed table names, used by validateSql.js to build its
// allow-list. Keep this in sync with the prose description below — ideally
// generate both from the same source of truth once the project matures.
export const SCHEMA_TABLES = ["CompositePerformance", "Benchmark", "Account"];

export const SCHEMA_DESCRIPTION = `
Table: CompositePerformance
  - CompositeID (int, primary key)
  - CompositeName (nvarchar) - display name of the investment composite e.g. 'US Large Cap Growth Composite', 'Global Equity Opportunities', 'US Core Fixed Income Composite', 'Tech Innovation Fund', 'Small Cap Dynamic Value'
  - YTDReturn (decimal) - year-to-date return, stored as a percentage e.g. 16.8
  - OneYearReturn (decimal) - 1-year return percentage e.g. 21.4
  - ThreeYearReturn (decimal) - 3-year return percentage e.g. 14.1
  - AsOfDate (date) - date the performance figures are valid for e.g. '2026-06-30'
  - BenchmarkID (int, foreign key -> Benchmark.BenchmarkID)

Table: Benchmark
  - BenchmarkID (int, primary key)
  - BenchmarkName (nvarchar) - benchmark index name e.g. 'S&P 500 Index', 'MSCI World Index', 'Bloomberg US Aggregate Bond', 'Nasdaq 100 Index', 'Russell 2000 Small-Cap'
  - BenchmarkReturn (decimal) - benchmark return percentage e.g. 14.5

Table: Account
  - AccountID (int, primary key)
  - AccountName (nvarchar) - client account name e.g. 'Alpha Tech Ventures Account', 'Apex Pension Trust Account A', 'Beacon Endowment Fund', 'Cedar Creek Fixed Income Account', 'Delta Global Growth Portfolio', 'Evergreen Tech Growth Account', 'Fidelity Partner Account B', 'Horizon Small-Cap Growth'
  - CompositeID (int, foreign key -> CompositePerformance.CompositeID)
  - MarketValue (decimal) - total market value in USD e.g. 12500000.00
  - InceptionDate (date) - account opening date e.g. '2021-03-15'
`;
