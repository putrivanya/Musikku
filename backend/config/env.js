
const path = require("path");

// Selalu membaca backend/.env
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

function wajib(nama, { minLength = 1 } = {}) {
  const nilai = process.env[nama];

  if (
    typeof nilai !== "string" ||
    nilai.trim().length < minLength
  ) {
    throw new Error(
      `Konfigurasi ${nama} wajib diisi (minimal ${minLength} karakter) di backend/.env.`
    );
  }

  return nilai.trim();
}

// Validasi JWT
const JWT_SECRET = wajib("JWT_SECRET", {
  minLength: 32,
});

if (
  /ganti|rahasia|secret|changeme|default/i.test(JWT_SECRET) ||
  new Set(JWT_SECRET).size < 10
) {
  throw new Error(
    "JWT_SECRET terlalu lemah. Gunakan nilai acak minimal 32 karakter."
  );
}

// Validasi port
const PORT = Number(process.env.PORT || 5000);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT harus berupa angka antara 1 sampai 65535.");
}

// Konfigurasi CORS
const CORS_ORIGINS = String(
  process.env.CORS_ORIGINS ||
    "http://localhost:5173,http://localhost:5000"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",

  PORT,

  DB_HOST: wajib("DB_HOST"),
  DB_PORT: Number(process.env.DB_PORT || 3306),
  DB_USER: wajib("DB_USER"),
  DB_PASSWORD: wajib("DB_PASSWORD"),
  DB_NAME: wajib("DB_NAME"),

  JWT_SECRET,

  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "2h",

  CORS_ORIGINS,

  TRUST_PROXY: process.env.TRUST_PROXY === "1",

  UPLOAD_MAX_BYTES: Number(
    process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024
  ),
};

module.exports = env;
