import mysql from "mysql2/promise";

let _pool = null;

function getPool() {
  if (!process.env.DB_CAMPAIGNS_USER || !process.env.DB_CAMPAIGNS_NAME) {
    throw new Error("Configura DB_CAMPAIGNS_* en .env.local para usar campañas.");
  }
  if (_pool) return _pool;
  _pool = mysql.createPool({
    host: process.env.DB_CAMPAIGNS_HOST || process.env.DB_HOST || "localhost",
    user: process.env.DB_CAMPAIGNS_USER,
    password: process.env.DB_CAMPAIGNS_PASSWORD,
    database: process.env.DB_CAMPAIGNS_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
  });
  return _pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return Array.isArray(rows) ? rows : [rows];
}

export async function getConnection() {
  return getPool().getConnection();
}

export default {
  execute: (...args) => getPool().execute(...args),
  getConnection: () => getPool().getConnection(),
};
