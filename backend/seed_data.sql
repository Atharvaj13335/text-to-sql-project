-- ============================================================================
-- SQL Server Seed Data Script for Financial Reporting System
-- Execute this script in SQL Server Management Studio (SSMS) or Azure Data Studio
-- ============================================================================

-- 1. Create Tables
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Benchmark')
BEGIN
    CREATE TABLE Benchmark (
        BenchmarkID INT PRIMARY KEY IDENTITY(1,1),
        BenchmarkName NVARCHAR(100) NOT NULL,
        BenchmarkReturn DECIMAL(5,2) NOT NULL
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CompositePerformance')
BEGIN
    CREATE TABLE CompositePerformance (
        CompositeID INT PRIMARY KEY IDENTITY(1,1),
        CompositeName NVARCHAR(100) NOT NULL,
        YTDReturn DECIMAL(5,2) NOT NULL,
        OneYearReturn DECIMAL(5,2) NOT NULL,
        ThreeYearReturn DECIMAL(5,2) NOT NULL,
        AsOfDate DATE NOT NULL,
        BenchmarkID INT FOREIGN KEY REFERENCES Benchmark(BenchmarkID)
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Account')
BEGIN
    CREATE TABLE Account (
        AccountID INT PRIMARY KEY IDENTITY(1,1),
        AccountName NVARCHAR(100) NOT NULL,
        CompositeID INT FOREIGN KEY REFERENCES CompositePerformance(CompositeID),
        MarketValue DECIMAL(15,2) NOT NULL,
        InceptionDate DATE NOT NULL
    );
END;

-- 2. Insert Sample Benchmarks
INSERT INTO Benchmark (BenchmarkName, BenchmarkReturn) VALUES
('S&P 500 Index', 14.50),
('MSCI World Index', 11.20),
('Bloomberg US Aggregate Bond', 3.80),
('Nasdaq 100 Index', 18.90),
('Russell 2000 Small-Cap', 8.40);

-- 3. Insert Sample Composite Performance Records
INSERT INTO CompositePerformance (CompositeName, YTDReturn, OneYearReturn, ThreeYearReturn, AsOfDate, BenchmarkID) VALUES
('US Large Cap Growth Composite', 16.80, 21.40, 14.10, '2026-06-30', 1),
('Global Equity Opportunities', 12.30, 15.60, 10.80, '2026-06-30', 2),
('US Core Fixed Income Composite', 4.10, 5.20, 3.90, '2026-06-30', 3),
('Tech Innovation Fund', 22.50, 28.70, 19.30, '2026-06-30', 4),
('Small Cap Dynamic Value', 9.60, 11.80, 8.50, '2026-06-30', 5);

-- 4. Insert Sample Client Accounts
INSERT INTO Account (AccountName, CompositeID, MarketValue, InceptionDate) VALUES
('Alpha Tech Ventures Account', 4, 12500000.00, '2021-03-15'),
('Apex Pension Trust Account A', 1, 45000000.00, '2019-01-10'),
('Beacon Endowment Fund', 2, 28750000.00, '2020-07-22'),
('Cedar Creek Fixed Income Account', 3, 18200000.00, '2018-11-05'),
('Delta Global Growth Portfolio', 2, 34100000.00, '2022-02-14'),
('Evergreen Tech Growth Account', 4, 8900000.00, '2023-05-01'),
('Fidelity Partner Account B', 1, 52300000.00, '2017-09-30'),
('Horizon Small-Cap Growth', 5, 14600000.00, '2022-10-18');
