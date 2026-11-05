const mysql = require("mysql2/promise");
const env = require("./env");

const db = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  // Kolom DATE dikembalikan apa adanya ("YYYY-MM-DD") agar tidak
  // bergeser satu hari akibat konversi ke UTC saat dikirim sebagai JSON.
  dateStrings: ["DATE"],
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
});

module.exports = db;
