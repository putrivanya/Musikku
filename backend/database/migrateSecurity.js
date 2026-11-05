/**
 * Migrasi keamanan & integritas database MusikKu.
 *
 * Jalankan dengan kredensial admin MySQL (bukan akun aplikasi):
 *   DB_ADMIN_USER=root DB_ADMIN_PASSWORD=... node database/migrateSecurity.js
 *
 * Script ini idempoten dan hanya mengubah struktur, bukan menghapus data.
 */
const path = require("path");
const mysql = require("mysql2/promise");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
});

const DB_NAME = process.env.DB_NAME || "db_alatmusik";
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3306);

if (!process.env.DB_ADMIN_USER) {
  console.error("DB_ADMIN_USER wajib diisi untuk menjalankan migrasi.");
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
    "DB_ADMIN_PASSWORD wajib diisi. Untuk MySQL lokal tanpa password, set DB_ALLOW_EMPTY_ADMIN_PASSWORD=1 secara eksplisit."
  );
  process.exit(1);
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [table, column]
  );

  return rows.length > 0;
}

async function indexExists(conn, table, indexName) {
  const [rows] = await conn.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [table, indexName]
  );

  return rows.length > 0;
}

async function constraintExists(conn, table, constraintName) {
  const [rows] = await conn.query(
    `SELECT 1
     FROM information_schema.table_constraints
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND constraint_name = ?
     LIMIT 1`,
    [table, constraintName]
  );

  return rows.length > 0;
}

async function addIndex(conn, table, indexName, columns) {
  if (await indexExists(conn, table, indexName)) return;

  await conn.query(
    `CREATE INDEX \`${indexName}\` ON \`${table}\` (${columns})`
  );
  console.log(`+ index ${table}.${indexName}`);
}

async function addCheck(conn, table, constraintName, expression) {
  if (await constraintExists(conn, table, constraintName)) return;

  try {
    await conn.query(
      `ALTER TABLE \`${table}\`
       ADD CONSTRAINT \`${constraintName}\` CHECK (${expression})`
    );
    console.log(`+ check ${table}.${constraintName}`);
  } catch (error) {
    console.warn(
      `! check ${table}.${constraintName} dilewati: ${error.message}`
    );
  }
}

async function migrate() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: process.env.DB_ADMIN_USER,
    password: adminPassword,
    database: DB_NAME,
    multipleStatements: false,
  });

  try {
    console.log(`Migrasi database ${DB_NAME}...`);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_role VARCHAR(50) NOT NULL UNIQUE
      ) ENGINE=InnoDB
    `);

    await conn.query(`
      INSERT IGNORE INTO roles (id, nama_role) VALUES
        (1, 'admin'),
        (2, 'petugas'),
        (3, 'peminjam')
    `);

    if (!(await columnExists(conn, "users", "email"))) {
      await conn.query(
        "ALTER TABLE users ADD COLUMN email VARCHAR(150) NULL AFTER nama"
      );
      console.log("+ users.email");
    }

    if (!(await columnExists(conn, "users", "role_id"))) {
      await conn.query(
        "ALTER TABLE users ADD COLUMN role_id INT NULL AFTER password"
      );

      if (await columnExists(conn, "users", "role")) {
        await conn.query(`
          UPDATE users
          SET role_id = CASE role
            WHEN 'admin' THEN 1
            WHEN 'petugas' THEN 2
            ELSE 3
          END
          WHERE role_id IS NULL
        `);
      }

      await conn.query(
        "UPDATE users SET role_id = 3 WHERE role_id IS NULL"
      );
      await conn.query(
        "ALTER TABLE users MODIFY role_id INT NOT NULL DEFAULT 3"
      );
      console.log("+ users.role_id");
    }

    if (!(await columnExists(conn, "users", "token_version"))) {
      await conn.query(
        "ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0"
      );
      console.log("+ users.token_version");
    }

    if (!(await columnExists(conn, "users", "failed_login_attempts"))) {
      await conn.query(
        "ALTER TABLE users ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0"
      );
      console.log("+ users.failed_login_attempts");
    }

    if (!(await columnExists(conn, "users", "locked_until"))) {
      await conn.query(
        "ALTER TABLE users ADD COLUMN locked_until DATETIME NULL"
      );
      console.log("+ users.locked_until");
    }

    if (!(await columnExists(conn, "alat", "foto"))) {
      await conn.query(
        "ALTER TABLE alat ADD COLUMN foto VARCHAR(255) NULL AFTER keterangan"
      );
      console.log("+ alat.foto");
    }

    await conn.query(
      "ALTER TABLE log_aktivitas MODIFY aktivitas VARCHAR(1000) NOT NULL"
    );
    console.log("= log_aktivitas.aktivitas -> VARCHAR(1000)");

    await conn.query(`
      ALTER TABLE peminjaman
      MODIFY status ENUM(
        'menunggu',
        'disetujui',
        'ditolak',
        'dibatalkan',
        'dipinjam',
        'selesai'
      ) NOT NULL DEFAULT 'menunggu'
    `);
    console.log("= peminjaman.status + dibatalkan");

    await addIndex(
      conn,
      "peminjaman",
      "idx_peminjaman_status",
      "`status`, `id`"
    );
    await addIndex(
      conn,
      "peminjaman",
      "idx_peminjaman_user",
      "`user_id`, `id`"
    );
    await addIndex(
      conn,
      "pengembalian",
      "idx_pengembalian_status",
      "`status`, `id`"
    );
    await addIndex(
      conn,
      "detail_peminjaman",
      "idx_detail_alat",
      "`alat_id`"
    );
    await addIndex(
      conn,
      "log_aktivitas",
      "idx_log_waktu",
      "`waktu`, `id`"
    );
    await addIndex(
      conn,
      "users",
      "idx_users_role",
      "`role_id`"
    );

    if (!(await indexExists(conn, "users", "uq_users_email"))) {
      const [duplikat] = await conn.query(`
        SELECT email
        FROM users
        WHERE email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1
        LIMIT 1
      `);

      if (duplikat.length) {
        console.warn(
          "! uq_users_email dilewati karena ada email duplikat. Perbaiki data terlebih dahulu."
        );
      } else {
        await conn.query(
          "ALTER TABLE users ADD UNIQUE KEY uq_users_email (email)"
        );
        console.log("+ unique users.email");
      }
    }

    if (
      !(await constraintExists(
        conn,
        "users",
        "fk_users_roles"
      ))
    ) {
      await conn.query(`
        ALTER TABLE users
        ADD CONSTRAINT fk_users_roles
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
      `);
      console.log("+ foreign key users.role_id");
    }

    await addCheck(conn, "alat", "chk_alat_stok", "stok >= 0");
    await addCheck(
      conn,
      "detail_peminjaman",
      "chk_detail_jumlah",
      "jumlah > 0"
    );
    await addCheck(
      conn,
      "pengembalian",
      "chk_pengembalian_denda",
      "denda >= 0"
    );

    console.log("Migrasi selesai.");
  } finally {
    await conn.end();
  }
}

migrate().catch((error) => {
  console.error("Migrasi gagal:", error.message);
  process.exit(1);
});
