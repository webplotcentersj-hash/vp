import mysql from "mysql2/promise";

let _pool = null;

function getPool() {
  if (!process.env.DB_USER || !process.env.DB_NAME) {
    throw new Error("Configura DB_HOST, DB_USER, DB_PASSWORD y DB_NAME en .env.local");
  }
  if (_pool) return _pool;
  _pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
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

export function getInsertId(connOrResult) {
  if (connOrResult?.insertId != null) return connOrResult.insertId;
  return 0;
}

export default {
  getConnection: () => getPool().getConnection(),
  execute: (...args) => getPool().execute(...args),
};
