-- =============================================================================
-- schema.sql — sample database for the Text-to-SQL intern project
-- Run this once against a fresh SQL Server database (e.g. SQL Server Express
-- locally, or Azure SQL). Matches backend/schema.js exactly — if you change
-- one, change the other.
-- =============================================================================

-- --- Tables ------------------------------------------------------------------

CREATE TABLE Benchmark (
    BenchmarkID     INT IDENTITY(1,1) PRIMARY KEY,
    BenchmarkName   NVARCHAR(100) NOT NULL,
    BenchmarkReturn DECIMAL(6,2) NOT NULL
);

CREATE TABLE CompositePerformance (
    CompositeID      INT IDENTITY(1,1) PRIMARY KEY,
    CompositeName    NVARCHAR(100) NOT NULL,
    YTDReturn        DECIMAL(6,2) NOT NULL,   -- stored as percentage, e.g. 12.40
    OneYearReturn    DECIMAL(6,2) NOT NULL,
    ThreeYearReturn  DECIMAL(6,2) NOT NULL,
    AsOfDate         DATE NOT NULL,
    BenchmarkID      INT NOT NULL FOREIGN KEY REFERENCES Benchmark(BenchmarkID)
);

CREATE TABLE Account (
    AccountID     INT IDENTITY(1,1) PRIMARY KEY,
    AccountName   NVARCHAR(150) NOT NULL,
    CompositeID   INT NOT NULL FOREIGN KEY REFERENCES CompositePerformance(CompositeID),
    MarketValue   DECIMAL(18,2) NOT NULL,
    InceptionDate DATE NOT NULL
);

-- --- Seed data -----------------------------------------------------------------

INSERT INTO Benchmark (BenchmarkName, BenchmarkReturn) VALUES
    ('S&P 500 TR', 15.60),
    ('Bloomberg US Agg Bond', 4.90),
    ('MSCI Emerging Markets', 6.20),
    ('MSCI World', 12.10);

INSERT INTO CompositePerformance (CompositeName, YTDReturn, OneYearReturn, ThreeYearReturn, AsOfDate, BenchmarkID) VALUES
    ('Growth Equity Composite',       18.40, 22.10, 14.30, '2026-06-30', 1),
    ('Balanced Income Composite',     11.20, 13.50,  9.80, '2026-06-30', 2),
    ('Fixed Income Core Composite',    6.80,  7.90,  5.10, '2026-06-30', 2),
    ('Emerging Markets Composite',     5.90,  8.20,  4.40, '2026-06-30', 3),
    ('Global Macro Composite',         4.10,  6.00,  5.50, '2026-06-30', 4);

INSERT INTO Account (AccountName, CompositeID, MarketValue, InceptionDate) VALUES
    ('Retirement Fund A',        1, 4200000.00, '2019-03-15'),
    ('Endowment Fund B',         2, 8750000.00, '2015-07-01'),
    ('Pension Plan C',           3, 12300000.00, '2011-01-10'),
    ('Foundation Fund D',        4, 2100000.00, '2021-09-22'),
    ('Sovereign Mandate E',      5, 30500000.00, '2017-05-05');

-- --- Least-privilege application login -----------------------------------------
-- The Node backend connects as this user, never as sa or a db_owner. Even if
-- every code-level check somehow failed, this user physically cannot write.

CREATE LOGIN readonly_app_user WITH PASSWORD = 'ChangeThisPassword!123';
CREATE USER readonly_app_user FOR LOGIN readonly_app_user;

GRANT SELECT ON dbo.Benchmark            TO readonly_app_user;
GRANT SELECT ON dbo.CompositePerformance TO readonly_app_user;
GRANT SELECT ON dbo.Account              TO readonly_app_user;

-- Explicitly confirm no write/DDL permissions (redundant with GRANT SELECT
-- only above, but documents intent for whoever reads this later).
DENY INSERT, UPDATE, DELETE, ALTER, CONTROL ON dbo.Benchmark            TO readonly_app_user;
DENY INSERT, UPDATE, DELETE, ALTER, CONTROL ON dbo.CompositePerformance TO readonly_app_user;
DENY INSERT, UPDATE, DELETE, ALTER, CONTROL ON dbo.Account              TO readonly_app_user;
