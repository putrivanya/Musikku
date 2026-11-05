const db = require("../config/database");

async function createTables() {
  let connection;

  try {
    connection = await db.getConnection();

    // 1. Role pengguna
    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_role VARCHAR(50) NOT NULL UNIQUE
      ) ENGINE=InnoDB
    `);

    await connection.query(`
      INSERT IGNORE INTO roles (id, nama_role) VALUES
        (1, 'admin'),
        (2, 'petugas'),
        (3, 'peminjam')
    `);

    // 2. Tabel pengguna
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(100) NOT NULL,
        email VARCHAR(150) NULL,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role_id INT NOT NULL DEFAULT 3,
        token_version INT NOT NULL DEFAULT 0,
        failed_login_attempts INT NOT NULL DEFAULT 0,
        locked_until DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_users_email (email),
        KEY idx_users_role (role_id),
        CONSTRAINT fk_users_roles
          FOREIGN KEY (role_id) REFERENCES roles(id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);

    // 3. Tabel kategori alat musik
    await connection.query(`
      CREATE TABLE IF NOT EXISTS kategori (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_kategori VARCHAR(100) NOT NULL UNIQUE,
        deskripsi TEXT
      ) ENGINE=InnoDB
    `);

    // 4. Tabel alat musik
    await connection.query(`
      CREATE TABLE IF NOT EXISTS alat (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kategori_id INT NOT NULL,
        nama_alat VARCHAR(100) NOT NULL,
        merk VARCHAR(100),
        stok INT NOT NULL DEFAULT 0,
        kondisi ENUM('baik', 'rusak ringan', 'rusak berat')
          NOT NULL DEFAULT 'baik',
        keterangan TEXT,
        foto VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_alat_kategori (kategori_id),
        CONSTRAINT chk_alat_stok CHECK (stok >= 0),
        CONSTRAINT fk_alat_kategori
          FOREIGN KEY (kategori_id) REFERENCES kategori(id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);

    // 5. Tabel peminjaman
    await connection.query(`
      CREATE TABLE IF NOT EXISTS peminjaman (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        nama_alat VARCHAR(255),
        tanggal_pinjam DATE NOT NULL,
        tanggal_rencana_kembali DATE NOT NULL,
        jaminan VARCHAR(255),
        status ENUM(
          'menunggu',
          'disetujui',
          'ditolak',
          'dibatalkan',
          'dipinjam',
          'selesai'
        ) NOT NULL DEFAULT 'menunggu',
        catatan TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_peminjaman_user (user_id, id),
        KEY idx_peminjaman_status (status, id),
        CONSTRAINT fk_peminjaman_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);

    // 6. Rincian alat dalam transaksi peminjaman
    await connection.query(`
      CREATE TABLE IF NOT EXISTS detail_peminjaman (
        id INT AUTO_INCREMENT PRIMARY KEY,
        peminjaman_id INT NOT NULL,
        alat_id INT NOT NULL,
        jumlah INT NOT NULL,
        KEY idx_detail_peminjaman (peminjaman_id),
        KEY idx_detail_alat (alat_id),
        CONSTRAINT chk_detail_jumlah CHECK (jumlah > 0),
        CONSTRAINT fk_detail_peminjaman
          FOREIGN KEY (peminjaman_id) REFERENCES peminjaman(id)
          ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT fk_detail_alat
          FOREIGN KEY (alat_id) REFERENCES alat(id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);

    // 7. Tabel pengembalian
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pengembalian (
        id INT AUTO_INCREMENT PRIMARY KEY,
        peminjaman_id INT NOT NULL UNIQUE,
        tanggal_kembali DATE,
        denda DECIMAL(12,2) NOT NULL DEFAULT 0,
        kondisi_kembali ENUM(
          'baik',
          'rusak ringan',
          'rusak berat'
        ) NOT NULL DEFAULT 'baik',
        catatan TEXT,
        status ENUM('belum kembali', 'dikembalikan')
          NOT NULL DEFAULT 'belum kembali',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_pengembalian_status (status, id),
        CONSTRAINT chk_pengembalian_denda CHECK (denda >= 0),
        CONSTRAINT fk_pengembalian_peminjaman
          FOREIGN KEY (peminjaman_id) REFERENCES peminjaman(id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);

    // 8. Log aktivitas pengguna
    await connection.query(`
      CREATE TABLE IF NOT EXISTS log_aktivitas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        aktivitas VARCHAR(1000) NOT NULL,
        waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_log_waktu (waktu, id),
        CONSTRAINT fk_log_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON UPDATE CASCADE ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    console.log("Berhasil membuat seluruh tabel database!");

    const [tables] = await connection.query("SHOW TABLES");
    console.log("Daftar tabel:");
    tables.forEach((table) => {
      console.log(Object.values(table)[0]);
    });
  } catch (error) {
    console.error("Gagal membuat tabel:", error.message);
    process.exitCode = 1;
  } finally {
    if (connection) connection.release();
    await db.end();
  }
}

createTables();
