import sql from "mssql";

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER, // should be a login with SELECT-only permission — see README
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true, // required for Azure SQL, safe to leave on generally
    trustServerCertificate: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise;

export function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}
