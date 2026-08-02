import mongoose from "mongoose";

const knowledgeDocSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    keywords: [{ type: String }],
    content: { type: String, required: true },
    termFrequencies: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

const KnowledgeDoc = mongoose.models.KnowledgeDoc || mongoose.model("KnowledgeDoc", knowledgeDocSchema);

const SEED_DOCUMENTS = [
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
4. Composite Return vs Benchmark = Join CompositePerformance c ON c.BenchmarkID = b.BenchmarkID to compare YTDReturn against BenchmarkReturn.
5. Alpha = YTDReturn - BenchmarkReturn.
6. Annualized Return = ((1 + TotalReturn)^(1/Years)) - 1.`,
  },
  {
    id: "sql_patterns_aggregation",
    category: "SQL Best Practices",
    title: "Aggregations and Joins T-SQL Patterns",
    keywords: ["sql", "join", "group by", "sum", "avg", "top", "select", "query", "pattern", "aggregate"],
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
  {
    id: "gips_compliance",
    category: "Regulatory & Compliance",
    title: "GIPS Compliance Standards for Portfolio Reporting",
    keywords: ["gips", "compliance", "reporting", "standards", "global investment", "composite", "verification"],
    content: `GIPS (Global Investment Performance Standards) Rules Relevant to Queries:
- All composites must include all actual fee-paying, discretionary portfolios that meet the composite definition.
- Returns must be calculated using time-weighted rates of return.
- Composites must exist for at least 5 years before applying for GIPS verification.
- Benchmark must be disclosed for each composite.
- Carve-outs must be separately managed with their own cash allocation if included in a composite.`,
  },
  {
    id: "risk_metrics",
    category: "Domain Calculations & Rules",
    title: "Risk & Volatility Metrics Definitions",
    keywords: ["risk", "volatility", "sharpe", "deviation", "drawdown", "beta", "correlation", "standard deviation"],
    content: `Financial Risk Metric Definitions:
- Sharpe Ratio = (Portfolio Return - Risk-Free Rate) / Standard Deviation.
- Maximum Drawdown = Largest peak-to-trough decline in portfolio value.
- Beta = Measure of a portfolio's sensitivity to market movements (market beta = 1.0).
- Tracking Error = Standard deviation of the difference between portfolio and benchmark returns.
- Information Ratio = Alpha / Tracking Error.`,
  },
];

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function computeTermFrequencies(doc) {
  const tokens = tokenize(`${doc.title} ${doc.content} ${doc.keywords.join(" ")}`);
  const tf = {};
  tokens.forEach((t) => {
    tf[t] = (tf[t] || 0) + 1;
  });
  const total = tokens.length || 1;
  Object.keys(tf).forEach((k) => {
    tf[k] = tf[k] / total;
  });
  return tf;
}

function tfidfScore(queryTokens, doc, idfMap) {
  let score = 0;
  const tf = doc.termFrequencies instanceof Map ? Object.fromEntries(doc.termFrequencies) : doc.termFrequencies || {};

  queryTokens.forEach((term) => {
    const termTf = tf[term] || 0;
    const idf = idfMap[term] || 0;
    score += termTf * idf;
    if (doc.keywords && doc.keywords.includes(term)) score += 0.5;
  });

  return score;
}

function computeIdf(docs, queryTokens) {
  const idf = {};
  const N = docs.length || 1;
  queryTokens.forEach((term) => {
    const docsWithTerm = docs.filter((d) => {
      const tf = d.termFrequencies instanceof Map ? Object.fromEntries(d.termFrequencies) : d.termFrequencies || {};
      return tf[term] !== undefined;
    }).length;
    idf[term] = Math.log((N + 1) / (docsWithTerm + 1)) + 1;
  });
  return idf;
}

let _inMemoryCache = null;

export async function seedKnowledgeBase() {
  try {
    if (mongoose.connection.readyState !== 1) return;

    const count = await KnowledgeDoc.countDocuments();
    if (count === 0) {
      const docsWithTf = SEED_DOCUMENTS.map((doc) => ({
        ...doc,
        termFrequencies: computeTermFrequencies(doc),
      }));
      await KnowledgeDoc.insertMany(docsWithTf, { ordered: false });
      console.log(`[RAG] Seeded ${docsWithTf.length} knowledge documents to MongoDB.`);
    }

    _inMemoryCache = await KnowledgeDoc.find({}).lean();
    console.log(`[RAG] Loaded ${_inMemoryCache.length} knowledge documents into cache.`);
  } catch (err) {
    console.warn("[RAG] Failed to seed/warm knowledge base from MongoDB:", err.message);
    _inMemoryCache = SEED_DOCUMENTS.map((doc) => ({
      ...doc,
      termFrequencies: computeTermFrequencies(doc),
    }));
  }
}

export async function retrieveRelevantKnowledgeAsync(query, topK = 3) {
  const docs = await getDocsFromCache();
  if (!query || typeof query !== "string") return docs.slice(0, topK);

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return docs.slice(0, topK);

  const idfMap = computeIdf(docs, queryTokens);

  const scored = docs.map((doc) => ({
    id: doc.id,
    category: doc.category,
    title: doc.title,
    keywords: doc.keywords,
    content: doc.content,
    score: tfidfScore(queryTokens, doc, idfMap),
  }));

  scored.sort((a, b) => b.score - a.score);

  const relevant = scored.filter((d) => d.score > 0);
  return (relevant.length > 0 ? relevant : scored).slice(0, topK);
}

export function retrieveRelevantKnowledge(query, topK = 3) {
  const docs = _inMemoryCache || SEED_DOCUMENTS.map((doc) => ({
    ...doc,
    termFrequencies: computeTermFrequencies(doc),
  }));

  if (!query || typeof query !== "string") return docs.slice(0, topK);

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return docs.slice(0, topK);

  const idfMap = computeIdf(docs, queryTokens);

  const scored = docs.map((doc) => ({
    id: doc.id,
    category: doc.category,
    title: doc.title,
    keywords: doc.keywords,
    content: doc.content,
    score: tfidfScore(queryTokens, doc, idfMap),
  }));

  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.filter((d) => d.score > 0);
  return (relevant.length > 0 ? relevant : scored).slice(0, topK);
}

async function getDocsFromCache() {
  if (_inMemoryCache) return _inMemoryCache;
  if (mongoose.connection.readyState === 1) {
    _inMemoryCache = await KnowledgeDoc.find({}).lean();
    return _inMemoryCache;
  }
  return SEED_DOCUMENTS.map((doc) => ({ ...doc, termFrequencies: computeTermFrequencies(doc) }));
}

export async function getAllKnowledgeDocs() {
  const docs = await getDocsFromCache();
  return docs.map(({ id, category, title, keywords, content, createdAt }) => ({
    id, category, title, keywords, content, createdAt,
  }));
}

export async function getKnowledgeDocById(id) {
  const docs = await getDocsFromCache();
  const doc = docs.find((d) => d.id === id);
  if (!doc) return null;
  return { id: doc.id, category: doc.category, title: doc.title, keywords: doc.keywords, content: doc.content };
}

export async function addKnowledgeDoc({ id, category, title, keywords, content }) {
  const tf = computeTermFrequencies({ title, content, keywords });
  const newDoc = new KnowledgeDoc({ id, category, title, keywords, content, termFrequencies: tf });
  await newDoc.save();
  _inMemoryCache = null;
  return { id, category, title, keywords, content };
}

export async function deleteKnowledgeDoc(id) {
  const result = await KnowledgeDoc.deleteOne({ id });
  _inMemoryCache = null;
  return result.deletedCount > 0;
}
