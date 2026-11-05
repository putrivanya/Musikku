/**
 * Bootstrap keamanan satu kali:
 * 1. Membuat akun MySQL aplikasi dengan hak minimum.
 * 2. Menulis backend/.env dengan kredensial acak dan JWT secret baru.
 *
 * Jalankan dengan kredensial admin MySQL:
 *   DB_ADMIN_USER=root DB_ALLOW_EMPTY_ADMIN_PASSWORD=1 node scripts/bootstrapSecurity.js
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const envPath = path.join(__dirname, "..", ".env");

require("dotenv").config({ path: envPath });

const DB_NAME = process.env.DB_NAME || "db_alatmusik";
const DB_HOST = "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const APP_USER = process.env.DB_APP_USER || "musikku_app";
const adminUser = process.env.DB_ADMIN_USER;

if (!adminUser) {
  console.error("DB_ADMIN_USER wajib diisi.");
  process.exit(1);
}

const adminPassword =
  process.env.DB_ADMIN_PASSWORD !== undefined
    ? process.env.DB_ADMIN_PASSWORD
    : process.env.DB_ALLOW_EMPTY_ADMIN_PASSWORD === "1"
      ? ""
      : undefined;

if (adminPassword === undefined) {
  console.error(
    "DB_ADMIN_PASSWORD wajib diisi atau set DB_ALLOW_EMPTY_ADMIN_PASSWORD=1 untuk MySQL lokal tanpa password."
  );
  process.exit(1);
}

if (!/^[a-zA-Z0-9_]+$/.test(DB_NAME)) {
  throw new Error("Nama database tidak valid.");
}

if (!/^[a-zA-Z0-9_]+$/.test(APP_USER)) {
  throw new Error("Nama user aplikasi tidak valid.");
}

async function main() {
  const appPassword = crypto.randomBytes(32).toString("base64url");
  const jwtSecret = crypto.randomBytes(64).toString("hex");

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: adminUser,
    password: adminPassword,
    database: DB_NAME,
  });

  try {
    for (const host of ["localhost", "127.0.0.1"]) {
      const account = `'${APP_USER}'@'${host}'`;

      await conn.query(
        `CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ?`,
        [appPassword]
      );
      await conn.query(`ALTER USER ${account} IDENTIFIED BY ?`, [
        appPassword,
      ]);
      await conn.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${DB_NAME}\`.* TO ${account}`
      );
    }

    await conn.query("FLUSH PRIVILEGES");
  } finally {
    await conn.end();
  }

  const isi = [
    "PORT=5000",
    `NODE_ENV=development`,
    `DB_HOST=${DB_HOST}`,
    `DB_PORT=${DB_PORT}`,
    `DB_USER=${APP_USER}`,
    `DB_PASSWORD=${appPassword}`,
    `DB_NAME=${DB_NAME}`,
    `JWT_SECRET=${jwtSecret}`,
    "JWT_EXPIRES_IN=2h",
    "CORS_ORIGINS=http://localhost:5173",
    "UPLOAD_MAX_BYTES=5242880",
    "",
  ].join("\n");

  const tempPath = `${envPath}.tmp`;
  fs.writeFileSync(tempPath, isi, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tempPath, envPath);

  console.log("Akun MySQL aplikasi dibuat dengan hak minimum.");
  console.log("backend/.env diperbarui dengan kredensial dan JWT secret baru.");
}

main().catch((error) => {
  console.error("Bootstrap gagal:", error.message);
  process.exit(1);
});
