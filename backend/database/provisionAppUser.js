/**
 * Membuat akun MySQL aplikasi dengan hak minimum (tanpa DDL).
 *
 *   DB_ADMIN_USER=root DB_ADMIN_PASSWORD=... DB_APP_PASSWORD=... \
 *   node database/provisionAppUser.js
 */
const path = require("path");
const mysql = require("mysql2/promise");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const DB_NAME = process.env.DB_NAME || "db_alatmusik";
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const APP_USER = process.env.DB_APP_USER || "musikku_app";
const APP_PASSWORD = process.env.DB_APP_PASSWORD;

if (!/^[a-zA-Z0-9_]+$/.test(DB_NAME)) {
  throw new Error("Nama database tidak valid.");
}

if (!/^[a-zA-Z0-9_]+$/.test(APP_USER)) {
  throw new Error("Nama user aplikasi tidak valid.");
}

if (!process.env.DB_ADMIN_USER) {
  throw new Error("DB_ADMIN_USER wajib diisi.");
}

const adminPassword =
  process.env.DB_ADMIN_PASSWORD !== undefined
    ? process.env.DB_ADMIN_PASSWORD
    : process.env.DB_ALLOW_EMPTY_ADMIN_PASSWORD === "1"
      ? ""
      : undefined;

if (adminPassword === undefined) {
  throw new Error(
    "DB_ADMIN_PASSWORD wajib diisi. Untuk MySQL lokal tanpa password, set DB_ALLOW_EMPTY_ADMIN_PASSWORD=1 secara eksplisit."
  );
}

if (typeof APP_PASSWORD !== "string" || APP_PASSWORD.length < 16) {
  throw new Error("DB_APP_PASSWORD wajib diisi minimal 16 karakter.");
}

async function main() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: process.env.DB_ADMIN_USER,
    password: adminPassword,
    database: DB_NAME,
  });

  try {
    const hosts = ["localhost", "127.0.0.1"];

    for (const host of hosts) {
      const account = `'${APP_USER}'@'${host}'`;

      await conn.query(
        `CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ?`,
        [APP_PASSWORD]
      );
      await conn.query(`ALTER USER ${account} IDENTIFIED BY ?`, [
        APP_PASSWORD,
      ]);
      await conn.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${DB_NAME}\`.* TO ${account}`
      );

      console.log(`Akun aplikasi siap: ${APP_USER}@${host}`);
    }

    await conn.query("FLUSH PRIVILEGES");
    console.log(
      "Hak akses: SELECT, INSERT, UPDATE, DELETE (tanpa DDL/GRANT)."
    );
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error("Provisioning gagal:", error.message);
  process.exit(1);
});
