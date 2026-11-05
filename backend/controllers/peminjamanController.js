
const db = require("../config/database");
const { teksOpsional } = require("../utils/validation");

const MENUNGGU = "menunggu";
const DISETUJUI = "disetujui";
const DITOLAK = "ditolak";
const DIBATALKAN = "dibatalkan";
const DIPINJAM = "dipinjam";
const SELESAI = "selesai";

const MAKS_HARI_PINJAM = 7;
const MAKS_ITEM = 10;

// =====================================================
// HELPER
// =====================================================

function isAdmin(req) {
  return String(req.user?.role || "").toLowerCase() === "admin";
}

function getUserId(req) {
  return req.user?.id ??
    req.user?.user_id ??
    req.user?.id_user ??
    null;
}

function validId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalisasiStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function pecahTanggal(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const [tahun, bulan, hari] = value.split("-").map(Number);

  const date = new Date(
    Date.UTC(tahun, bulan - 1, hari)
  );

  if (
    date.getUTCFullYear() !== tahun ||
    date.getUTCMonth() !== bulan - 1 ||
    date.getUTCDate() !== hari
  ) {
    return null;
  }

  return { tahun, bulan, hari };
}

function tanggalValid(value) {
  return pecahTanggal(value) !== null;
}

function tanggalHariIni() {
  const sekarang = new Date();

  return [
    sekarang.getFullYear(),
    String(sekarang.getMonth() + 1).padStart(2, "0"),
    String(sekarang.getDate()).padStart(2, "0"),
  ].join("-");
}

function selisihHari(dari, sampai) {
  const awal = pecahTanggal(dari);
  const akhir = pecahTanggal(sampai);

  if (!awal || !akhir) return null;

  return Math.round(
    (
      Date.UTC(akhir.tahun, akhir.bulan - 1, akhir.hari) -
      Date.UTC(awal.tahun, awal.bulan - 1, awal.hari)
    ) / 86400000
  );
}

function ambilJaminan(body = {}) {
  // Prioritaskan jaminan yang dikirim form.
  // Jika tidak tersedia, gunakan jenis_jaminan.
  const nilai = body.jaminan ?? body.jenis_jaminan ?? "";

  if (typeof nilai !== "string") return null;

  return teksOpsional(nilai, 255);
}

function ambilItems(body = {}) {
  const sumber = body.items ?? body.alat ?? body.detail ?? [];

  if (Array.isArray(sumber) && sumber.length > 0) {
    return sumber.map((item) => ({
      alat_id: Number(
        item.alat_id ??
        item.id_alat ??
        item.id ??
        item.alatId
      ),
      jumlah: Number(item.jumlah ?? item.quantity ?? 1),
    }));
  }

  const alatId = body.alat_id ?? body.id_alat ?? body.alatId;

  if (alatId !== undefined && alatId !== null && alatId !== "") {
    return [{
      alat_id: Number(alatId),
      jumlah: Number(body.jumlah ?? 1),
    }];
  }

  return [];
}

function validasiItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "Pilih minimal satu alat musik.";
  }

  if (items.length > MAKS_ITEM) {
    return `Maksimal ${MAKS_ITEM} jenis alat musik.`;
  }

  const gabungan = new Map();

  for (const item of items) {
    if (!Number.isInteger(item.alat_id) || item.alat_id < 1) {
      return "ID alat musik tidak valid.";
    }

    if (!Number.isInteger(item.jumlah) || item.jumlah < 1) {
      return "Jumlah alat minimal 1.";
    }

    gabungan.set(
      item.alat_id,
      (gabungan.get(item.alat_id) || 0) + item.jumlah
    );
  }

  return [...gabungan.entries()].map(([alat_id, jumlah]) => ({
    alat_id,
    jumlah,
  }));
}

function ringkasanNamaAlat(nama) {
  const hasil = nama.join(", ");

  return hasil.length > 255
    ? `${hasil.slice(0, 252)}...`
    : hasil;
}

async function rollbackAman(connection) {
  if (!connection) return;

  try {
    await connection.rollback();
  } catch (error) {
    console.error("Rollback gagal:", error.message);
  }
}

async function ambilDetailAlat(connection, peminjamanId) {
  const [rows] = await connection.query(
    `SELECT
       d.alat_id,
       d.jumlah,
       a.nama_alat,
       a.stok
     FROM detail_peminjaman d
     INNER JOIN alat a ON a.id = d.alat_id
     WHERE d.peminjaman_id = ?
     ORDER BY d.alat_id
     FOR UPDATE`,
    [peminjamanId]
  );

  return rows;
}

async function periksaPeminjam(connection, userId) {
  const [rows] = await connection.query(
    `SELECT u.id
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
       AND LOWER(r.nama_role) = 'peminjam'
     LIMIT 1`,
    [userId]
  );

  return rows.length > 0;
}

async function ambilDanValidasiNamaAlat(connection, items) {
  const namaAlat = [];

  for (const item of items) {
    const [rows] = await connection.query(
      `SELECT id, nama_alat, stok
       FROM alat
       WHERE id = ?
       FOR UPDATE`,
      [item.alat_id]
    );

    if (!rows.length) {
      return {
        error: `Alat dengan ID ${item.alat_id} tidak ditemukan.`,
      };
    }

    const alat = rows[0];

    if (Number(alat.stok) < item.jumlah) {
      return {
        error: `Stok ${alat.nama_alat} tidak mencukupi.`,
      };
    }

    namaAlat.push(alat.nama_alat);
  }

  return { namaAlat };
}

function validasiTanggalPinjam(tanggalPinjam, tanggalKembali) {
  if (
    !tanggalValid(tanggalPinjam) ||
    !tanggalValid(tanggalKembali)
  ) {
    return "Format tanggal harus YYYY-MM-DD.";
  }

  if (tanggalPinjam < tanggalHariIni()) {
    return "Tanggal pinjam tidak boleh sebelum hari ini.";
  }

  const durasi = selisihHari(tanggalPinjam, tanggalKembali);

  if (durasi === null || durasi < 0) {
    return "Tanggal kembali tidak boleh sebelum tanggal pinjam.";
  }

  if (durasi > MAKS_HARI_PINJAM) {
    return "Durasi peminjaman maksimal 7 hari.";
  }

  return null;
}

// =====================================================
// CREATE PEMINJAMAN
// =====================================================

exports.createPeminjaman = async (req, res) => {
  req.body = req.body || {};

  const admin = isAdmin(req);

  const userId = admin
    ? validId(req.body.user_id)
    : validId(getUserId(req));

  const tanggalPinjam = req.body.tanggal_pinjam;

  const tanggalKembali =
    req.body.tanggal_rencana_kembali ??
    req.body.tanggal_kembali;

  const jaminan = ambilJaminan(req.body);
  const catatanInput = req.body.catatan;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: admin
        ? "Pilih pengguna peminjam terlebih dahulu."
        : "ID pengguna tidak ditemukan.",
    });
  }

  const errorTanggal = validasiTanggalPinjam(
    tanggalPinjam,
    tanggalKembali
  );

  if (errorTanggal) {
    return res.status(400).json({
      success: false,
      message: errorTanggal,
    });
  }

  if (
    jaminan === null ||
    (
      req.body.jaminan != null &&
      typeof req.body.jaminan !== "string"
    ) ||
    (
      req.body.jenis_jaminan != null &&
      typeof req.body.jenis_jaminan !== "string"
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Jaminan tidak valid.",
    });
  }

  if (
    catatanInput != null &&
    (
      typeof catatanInput !== "string" ||
      catatanInput.trim().length > 1000
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Catatan maksimal 1000 karakter.",
    });
  }

  const items = validasiItems(ambilItems(req.body));

  if (typeof items === "string") {
    return res.status(400).json({
      success: false,
      message: items,
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    if (admin) {
      const valid = await periksaPeminjam(connection, userId);

      if (!valid) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message: "Pengguna yang dipilih bukan akun peminjam.",
        });
      }
    }

    const hasilAlat = await ambilDanValidasiNamaAlat(
      connection,
      items
    );

    if (hasilAlat.error) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: hasilAlat.error,
      });
    }

    const namaAlat = ringkasanNamaAlat(hasilAlat.namaAlat);

    const catatan = teksOpsional(catatanInput, 1000);

    const [hasil] = await connection.query(
      `INSERT INTO peminjaman
       (
         user_id,
         nama_alat,
         tanggal_pinjam,
         tanggal_rencana_kembali,
         jaminan,
         status,
         catatan
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        namaAlat,
        tanggalPinjam,
        tanggalKembali,
        jaminan,
        MENUNGGU,
        catatan,
      ]
    );

    const peminjamanId = hasil.insertId;

    for (const item of items) {
      await connection.query(
        `INSERT INTO detail_peminjaman
         (peminjaman_id, alat_id, jumlah)
         VALUES (?, ?, ?)`,
        [peminjamanId, item.alat_id, item.jumlah]
      );
    }

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Peminjaman berhasil dibuat.",
      data: {
        id: peminjamanId,
        user_id: userId,
        nama_alat: namaAlat,
        tanggal_pinjam: tanggalPinjam,
        tanggal_rencana_kembali: tanggalKembali,
        jaminan,
        status: MENUNGGU,
        items,
      },
    });
  } catch (error) {
    await rollbackAman(connection);
    console.error("createPeminjaman:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal membuat peminjaman.",
    });
  } finally {
    if (connection) connection.release();
  }
};

// =====================================================
// GET PEMINJAMAN SAYA
// =====================================================

exports.getPeminjamanSaya = async (req, res) => {
  const userId = validId(getUserId(req));

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "ID pengguna tidak ditemukan.",
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT
         p.id,
         p.user_id,
         u.nama AS nama_peminjam,
         p.nama_alat,
         p.tanggal_pinjam,
         p.tanggal_rencana_kembali,
         p.jaminan,
         p.status,
         p.catatan,
         p.created_at,
         pg.id AS pengembalian_id,
         pg.status AS status_pengembalian,
         pg.tanggal_kembali,
         pg.denda,
         (
           SELECT COALESCE(
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'alat_id', d.alat_id,
                 'nama_alat', a.nama_alat,
                 'jumlah', d.jumlah
               )
             ),
             JSON_ARRAY()
           )
           FROM detail_peminjaman d
           INNER JOIN alat a ON a.id = d.alat_id
           WHERE d.peminjaman_id = p.id
         ) AS items
       FROM peminjaman p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN pengembalian pg ON pg.peminjaman_id = p.id
       WHERE p.user_id = ?
       ORDER BY p.id DESC`,
      [userId]
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("getPeminjamanSaya:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil peminjaman.",
    });
  }
};

// =====================================================
// GET SEMUA PEMINJAMAN
// =====================================================

exports.getAllPeminjaman = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         p.id,
         p.user_id,
         u.nama AS nama_peminjam,
         p.nama_alat,
         p.tanggal_pinjam,
         p.tanggal_rencana_kembali,
         p.jaminan,
         p.status,
         p.catatan,
         p.created_at,
         (
           SELECT COALESCE(
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'alat_id', d.alat_id,
                 'nama_alat', a.nama_alat,
                 'jumlah', d.jumlah
               )
             ),
             JSON_ARRAY()
           )
           FROM detail_peminjaman d
           INNER JOIN alat a ON a.id = d.alat_id
           WHERE d.peminjaman_id = p.id
         ) AS items
       FROM peminjaman p
       LEFT JOIN users u ON u.id = p.user_id
       ORDER BY p.id DESC`
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("getAllPeminjaman:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil seluruh peminjaman.",
    });
  }
};

// =====================================================
// UPDATE STATUS PEMINJAMAN
// =====================================================

exports.updateStatusPeminjaman = async (req, res) => {
  const id = validId(req.params.id);
  const statusBaru = normalisasiStatus(req.body?.status);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "ID peminjaman tidak valid.",
    });
  }

  if (![DISETUJUI, DITOLAK].includes(statusBaru)) {
    return res.status(400).json({
      success: false,
      message: "Status hanya boleh disetujui atau ditolak.",
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, status
       FROM peminjaman
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Peminjaman tidak ditemukan.",
      });
    }

    if (normalisasiStatus(rows[0].status) !== MENUNGGU) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Peminjaman sudah pernah diproses.",
      });
    }

    if (statusBaru === DISETUJUI) {
      const details = await ambilDetailAlat(connection, id);

      if (!details.length) {
        await connection.rollback();

        return res.status(409).json({
          success: false,
          message: "Detail alat tidak ditemukan.",
        });
      }

      for (const item of details) {
        if (Number(item.stok) < Number(item.jumlah)) {
          await connection.rollback();

          return res.status(409).json({
            success: false,
            message: `Stok ${item.nama_alat} tidak mencukupi.`,
          });
        }
      }

      for (const item of details) {
        const [result] = await connection.query(
          `UPDATE alat
           SET stok = stok - ?
           WHERE id = ? AND stok >= ?`,
          [item.jumlah, item.alat_id, item.jumlah]
        );

        if (result.affectedRows !== 1) {
          throw new Error("Gagal mengurangi stok alat.");
        }
      }
    }

    const [result] = await connection.query(
      `UPDATE peminjaman
       SET status = ?
       WHERE id = ? AND status = ?`,
      [statusBaru, id, MENUNGGU]
    );

    if (result.affectedRows !== 1) {
      throw new Error("Gagal memperbarui status peminjaman.");
    }

    await connection.commit();

    return res.json({
      success: true,
      message: statusBaru === DISETUJUI
        ? "Peminjaman disetujui. Stok telah dikurangi."
        : "Peminjaman berhasil ditolak.",
      data: { id, status: statusBaru },
    });
  } catch (error) {
    await rollbackAman(connection);
    console.error("updateStatusPeminjaman:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui status peminjaman.",
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.setujuiPeminjaman = async (req, res) => {
  req.body = {
    ...req.body,
    status: DISETUJUI,
  };

  return exports.updateStatusPeminjaman(req, res);
};

exports.tolakPeminjaman = async (req, res) => {
  req.body = {
    ...req.body,
    status: DITOLAK,
  };

  return exports.updateStatusPeminjaman(req, res);
};

// =====================================================
// MENYERAHKAN ALAT
// =====================================================

exports.pinjamkanPeminjaman = async (req, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "ID peminjaman tidak valid.",
    });
  }

  try {
    const [result] = await db.query(
      `UPDATE peminjaman
       SET status = ?
       WHERE id = ?
         AND status = ?`,
      [DIPINJAM, id, DISETUJUI]
    );

    if (result.affectedRows !== 1) {
      return res.status(409).json({
        success: false,
        message:
          "Hanya peminjaman yang sudah disetujui yang dapat diserahkan.",
      });
    }

    return res.json({
      success: true,
      message: "Alat berhasil diserahkan.",
      data: { id, status: DIPINJAM },
    });
  } catch (error) {
    console.error("pinjamkanPeminjaman:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menyerahkan alat.",
    });
  }
};

// =====================================================
// MEMBATALKAN PEMINJAMAN YANG DISETUJUI
// =====================================================

exports.batalkanPeminjaman = async (req, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "ID peminjaman tidak valid.",
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, status
       FROM peminjaman
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Peminjaman tidak ditemukan.",
      });
    }

    if (normalisasiStatus(rows[0].status) !== DISETUJUI) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message:
          "Hanya peminjaman disetujui yang belum diserahkan dapat dibatalkan.",
      });
    }

    const details = await ambilDetailAlat(connection, id);

    if (!details.length) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Detail alat tidak ditemukan.",
      });
    }

    for (const item of details) {
      const [result] = await connection.query(
        `UPDATE alat
         SET stok = stok + ?
         WHERE id = ?`,
        [item.jumlah, item.alat_id]
      );

      if (result.affectedRows !== 1) {
        throw new Error("Gagal mengembalikan stok.");
      }
    }

    const [result] = await connection.query(
      `UPDATE peminjaman
       SET status = ?
       WHERE id = ? AND status = ?`,
      [DIBATALKAN, id, DISETUJUI]
    );

    if (result.affectedRows !== 1) {
      throw new Error("Gagal membatalkan peminjaman.");
    }

    await connection.commit();

    return res.json({
      success: true,
      message: "Peminjaman dibatalkan dan stok dikembalikan.",
      data: { id, status: DIBATALKAN },
    });
  } catch (error) {
    await rollbackAman(connection);
    console.error("batalkanPeminjaman:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal membatalkan peminjaman.",
    });
  } finally {
    if (connection) connection.release();
  }
};

// =====================================================
// UPDATE PEMINJAMAN
// Hanya status menunggu yang bisa diedit.
// =====================================================

exports.updatePeminjaman = async (req, res) => {
  const id = validId(req.params.id);
  const admin = isAdmin(req);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "ID peminjaman tidak valid.",
    });
  }

  const tanggalPinjam = req.body?.tanggal_pinjam;

  const tanggalKembali =
    req.body?.tanggal_rencana_kembali ??
    req.body?.tanggal_kembali;

  const errorTanggal = validasiTanggalPinjam(
    tanggalPinjam,
    tanggalKembali
  );

  if (errorTanggal) {
    return res.status(400).json({
      success: false,
      message: errorTanggal,
    });
  }

  const jaminan = ambilJaminan(req.body);
  const catatanInput = req.body?.catatan;

  if (
    jaminan === null ||
    (
      req.body?.jaminan != null &&
      typeof req.body.jaminan !== "string"
    ) ||
    (
      req.body?.jenis_jaminan != null &&
      typeof req.body.jenis_jaminan !== "string"
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Jaminan tidak valid.",
    });
  }

  if (
    catatanInput != null &&
    (
      typeof catatanInput !== "string" ||
      catatanInput.trim().length > 1000
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Catatan maksimal 1000 karakter.",
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, user_id, status
       FROM peminjaman
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Peminjaman tidak ditemukan.",
      });
    }

    const loan = rows[0];

    if (
      !admin &&
      Number(loan.user_id) !== Number(getUserId(req))
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: "Tidak boleh mengedit transaksi pengguna lain.",
      });
    }

    if (normalisasiStatus(loan.status) !== MENUNGGU) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Hanya peminjaman menunggu yang dapat diedit.",
      });
    }

    let userId = Number(loan.user_id);

    if (admin && req.body.user_id !== undefined) {
      userId = validId(req.body.user_id);

      if (
        !userId ||
        !(await periksaPeminjam(connection, userId))
      ) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message: "Akun peminjam yang dipilih tidak valid.",
        });
      }
    }

    let namaAlat = null;
    let items = null;

    const adaPerubahanAlat =
      req.body.items !== undefined ||
      req.body.alat !== undefined ||
      req.body.detail !== undefined ||
      req.body.alat_id !== undefined ||
      req.body.id_alat !== undefined;

    if (adaPerubahanAlat) {
      items = validasiItems(ambilItems(req.body));

      if (typeof items === "string") {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message: items,
        });
      }

      const hasilAlat = await ambilDanValidasiNamaAlat(
        connection,
        items
      );

      if (hasilAlat.error) {
        await connection.rollback();

        return res.status(409).json({
          success: false,
          message: hasilAlat.error,
        });
      }

      namaAlat = ringkasanNamaAlat(hasilAlat.namaAlat);

      await connection.query(
        `DELETE FROM detail_peminjaman
         WHERE peminjaman_id = ?`,
        [id]
      );

      for (const item of items) {
        await connection.query(
          `INSERT INTO detail_peminjaman
           (peminjaman_id, alat_id, jumlah)
           VALUES (?, ?, ?)`,
          [id, item.alat_id, item.jumlah]
        );
      }
    }

    await connection.query(
      `UPDATE peminjaman
       SET user_id = ?,
           nama_alat = COALESCE(?, nama_alat),
           tanggal_pinjam = ?,
           tanggal_rencana_kembali = ?,
           jaminan = ?,
           catatan = ?
       WHERE id = ?`,
      [
        userId,
        namaAlat,
        tanggalPinjam,
        tanggalKembali,
        jaminan,
        teksOpsional(catatanInput, 1000),
        id,
      ]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Data peminjaman berhasil diperbarui.",
      data: {
        id,
        user_id: userId,
        jaminan,
        items,
        tanggal_pinjam: tanggalPinjam,
        tanggal_rencana_kembali: tanggalKembali,
      },
    });
  } catch (error) {
    await rollbackAman(connection);
    console.error("updatePeminjaman:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui peminjaman.",
    });
  } finally {
    if (connection) connection.release();
  }
};

// =====================================================
// DELETE PEMINJAMAN
// =====================================================

exports.deletePeminjaman = async (req, res) => {
  const id = validId(req.params.id);
  const admin = isAdmin(req);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "ID peminjaman tidak valid.",
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, user_id, status
       FROM peminjaman
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Peminjaman tidak ditemukan.",
      });
    }

    const loan = rows[0];

    if (
      !admin &&
      Number(loan.user_id) !== Number(getUserId(req))
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: "Tidak boleh menghapus transaksi pengguna lain.",
      });
    }

    const status = normalisasiStatus(loan.status);

    if (![MENUNGGU, DITOLAK, DIBATALKAN].includes(status)) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: status === DISETUJUI
          ? "Batalkan peminjaman terlebih dahulu agar stok dikembalikan."
          : "Transaksi yang sedang dipinjam atau sudah selesai tidak dapat dihapus.",
      });
    }

    const [pengembalian] = await connection.query(
      `SELECT id
       FROM pengembalian
       WHERE peminjaman_id = ?
       LIMIT 1`,
      [id]
    );

    if (pengembalian.length) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message:
          "Transaksi memiliki riwayat pengembalian dan tidak dapat dihapus.",
      });
    }

    await connection.query(
      `DELETE FROM detail_peminjaman
       WHERE peminjaman_id = ?`,
      [id]
    );

    await connection.query(
      `DELETE FROM peminjaman
       WHERE id = ?`,
      [id]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Data peminjaman berhasil dihapus.",
    });
  } catch (error) {
    await rollbackAman(connection);
    console.error("deletePeminjaman:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus peminjaman.",
    });
  } finally {
    if (connection) connection.release();
  }
};
