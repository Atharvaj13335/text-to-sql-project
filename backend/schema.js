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
  - CompositeName (nvarchar) - display name of the investment composite
  - YTDReturn (decimal) - year-to-date return, stored as a percentage e.g. 12.4
  - OneYearReturn (decimal)
  - ThreeYearReturn (decimal)
  - AsOfDate (date) - date the performance figures are valid for
  - BenchmarkID (int, foreign key -> Benchmark.BenchmarkID)

Table: Benchmark
  - BenchmarkID (int, primary key)
  - BenchmarkName (nvarchar)
  - BenchmarkReturn (decimal)

Table: Account
  - AccountID (int, primary key)
  - AccountName (nvarchar)
  - CompositeID (int, foreign key -> CompositePerformance.CompositeID)
  - MarketValue (decimal)
  - InceptionDate (date)
`;
