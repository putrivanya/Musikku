const db = require("../config/database");
const { catatAktivitas } = require("../utils/logAktivitas");

const DENDA_PER_HARI = 50000;

const DENDA_KERUSAKAN = {
  baik: 0,
  "rusak ringan": 100000,
  "rusak berat": 200000,
};

function isAdmin(req) {
  return String(req.user?.role || "").toLowerCase() === "admin";
}

function getUserId(req) {
  return (
    req.user?.id ??
    req.user?.user_id ??
    req.user?.id_user ??
    null
  );
}

function validId(value) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function normalisasiKondisi(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
}

function normalisasiStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function validasiKondisi(value) {
  return Object.prototype.hasOwnProperty.call(
    DENDA_KERUSAKAN,
    normalisasiKondisi(value)
  );
}

function validasiTanggal(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function formatTanggal(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  return String(value).slice(0, 10);
}

function tanggalHariIni() {
  const sekarang = new Date();

  return [
    sekarang.getFullYear(),
    String(sekarang.getMonth() + 1).padStart(2, "0"),
    String(sekarang.getDate()).padStart(2, "0"),
  ].join("-");
}

function hitungHariTerlambat(tanggalRencana, tanggalAktual) {
  const rencana = formatTanggal(tanggalRencana);
  const aktual = formatTanggal(tanggalAktual);

  if (!rencana || !aktual) return 0;

  const awal = new Date(`${rencana}T00:00:00.000Z`);
  const akhir = new Date(`${aktual}T00:00:00.000Z`);

  return Math.max(
    0,
    Math.floor(
      (akhir.getTime() - awal.getTime()) / 86400000
    )
  );
}

function hitungDenda(tanggalRencana, tanggalAktual, kondisi) {
  const hariTerlambat = hitungHariTerlambat(
    tanggalRencana,
    tanggalAktual
  );

  const dendaTerlambat =
    hariTerlambat * DENDA_PER_HARI;

  const dendaKerusakan =
    DENDA_KERUSAKAN[normalisasiKondisi(kondisi)] ?? 0;

  return {
    hari_terlambat: hariTerlambat,
    denda_terlambat: dendaTerlambat,
    denda_kerusakan: dendaKerusakan,
    total_denda: dendaTerlambat + dendaKerusakan,
  };
}

function validasiCatatan(catatan) {
  return (
    catatan === undefined ||
    catatan === null ||
    (
      typeof catatan === "string" &&
      catatan.trim().length <= 1000
    )
  );
}

function validasiTanggalPengembalian(
  tanggalPinjam,
  tanggalKembali
) {
  const tanggalAwal = formatTanggal(tanggalPinjam);

  return Boolean(
    tanggalAwal &&
    tanggalKembali >= tanggalAwal &&
    tanggalKembali <= tanggalHariIni()
  );
}

async function rollbackAman(connection) {
  if (!connection) return;

  try {
    await connection.rollback();
  } catch (error) {
    console.error("Rollback gagal:", error.message);
  }
}

async function catatLog(userId, pesan) {
  try {
    if (userId) {
      await catatAktivitas(userId, pesan);
    }
  } catch (error) {
    console.error("Gagal mencatat aktivitas:", error.message);
  }
}

// =====================================================
// GET SEMUA PENGEMBALIAN
// =====================================================

exports.getAllPengembalian = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         pg.id,
         pg.peminjaman_id,
         u.nama AS nama_peminjam,
         p.user_id,
         p.nama_alat,
         p.tanggal_pinjam,
         p.tanggal_rencana_kembali,
         pg.tanggal_kembali,
         pg.denda,
         pg.kondisi_kembali,
         pg.catatan,
         pg.status,
         pg.created_at,
         p.status AS status_peminjaman,
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
       FROM pengembalian pg
       INNER JOIN peminjaman p
         ON p.id = pg.peminjaman_id
       INNER JOIN users u
         ON u.id = p.user_id
       ORDER BY
         CASE
           WHEN pg.status = 'belum kembali' THEN 0
           ELSE 1
         END,
         pg.id DESC`
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("getAllPengembalian:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data pengembalian.",
    });
  }
};

// =====================================================
// GET PENGEMBALIAN SAYA
// =====================================================

exports.getPengembalianSaya = async (req, res) => {
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
         pg.id,
         pg.peminjaman_id,
         p.nama_alat,
         p.tanggal_pinjam,
         p.tanggal_rencana_kembali,
         pg.tanggal_kembali,
         pg.denda,
         pg.kondisi_kembali,
         pg.catatan,
         pg.status,
         pg.created_at,
         p.status AS status_peminjaman,
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
       FROM pengembalian pg
       INNER JOIN peminjaman p
         ON p.id = pg.peminjaman_id
       WHERE p.user_id = ?
       ORDER BY pg.id DESC`,
      [userId]
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("getPengembalianSaya:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil riwayat pengembalian.",
    });
  }
};

// =====================================================
// CREATE PENGEMBALIAN
// Admin dapat memilih peminjaman milik pengguna lain.
// Peminjam hanya dapat mengajukan miliknya sendiri.
// =====================================================

exports.createPengembalian = async (req, res) => {
  const admin = isAdmin(req);

  const {
    peminjaman_id,
    tanggal_kembali,
    kondisi_kembali = "baik",
    catatan = "",
  } = req.body || {};

  const loanId = validId(peminjaman_id);
  const kondisi = normalisasiKondisi(kondisi_kembali);

  if (
    !loanId ||
    !validasiTanggal(tanggal_kembali) ||
    !validasiKondisi(kondisi) ||
    !validasiCatatan(catatan)
  ) {
    return res.status(400).json({
      success: false,
      message: "Data pengembalian tidak valid.",
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [loanRows] = await connection.query(
      `SELECT
         id,
         user_id,
         status,
         tanggal_pinjam,
         tanggal_rencana_kembali
       FROM peminjaman
       WHERE id = ?
       FOR UPDATE`,
      [loanId]
    );

    if (!loanRows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Peminjaman tidak ditemukan.",
      });
    }

    const loan = loanRows[0];

    if (
      !admin &&
      Number(loan.user_id) !== Number(getUserId(req))
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: "Tidak berhak mengajukan pengembalian ini.",
      });
    }

    if (normalisasiStatus(loan.status) !== "dipinjam") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message:
          "Hanya peminjaman berstatus dipinjam yang dapat dikembalikan.",
        status_peminjaman: loan.status,
      });
    }

    if (
      !validasiTanggalPengembalian(
        loan.tanggal_pinjam,
        tanggal_kembali
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Tanggal kembali harus berada antara tanggal pinjam dan hari ini.",
      });
    }

    const [detailRows] = await connection.query(
      `SELECT id
       FROM detail_peminjaman
       WHERE peminjaman_id = ?
       LIMIT 1`,
      [loanId]
    );

    if (!detailRows.length) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Detail alat tidak ditemukan.",
      });
    }

    const [existingRows] = await connection.query(
      `SELECT id
       FROM pengembalian
       WHERE peminjaman_id = ?
       LIMIT 1`,
      [loanId]
    );

    if (existingRows.length) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Pengajuan pengembalian sudah ada.",
      });
    }

    const perhitungan = hitungDenda(
      loan.tanggal_rencana_kembali,
      tanggal_kembali,
      kondisi
    );

    const [result] = await connection.query(
      `INSERT INTO pengembalian
       (
         peminjaman_id,
         tanggal_kembali,
         denda,
         kondisi_kembali,
         catatan,
         status
       )
       VALUES (?, ?, ?, ?, ?, 'belum kembali')`,
      [
        loanId,
        tanggal_kembali,
        perhitungan.total_denda,
        kondisi,
        String(catatan || "").trim() || null,
      ]
    );

    await connection.commit();

    await catatLog(
      getUserId(req),
      `Membuat data pengembalian untuk peminjaman ID ${loanId}`
    );

    return res.status(201).json({
      success: true,
      message: "Data pengembalian berhasil dibuat.",
      data: {
        id: result.insertId,
        peminjaman_id: loanId,
        tanggal_kembali,
        kondisi_kembali: kondisi,
        denda: perhitungan.total_denda,
        hari_terlambat: perhitungan.hari_terlambat,
        status: "belum kembali",
      },
    });
  } catch (error) {
    await rollbackAman(connection);
    console.error("createPengembalian:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Pengajuan pengembalian sudah ada.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Gagal membuat pengembalian.",
    });
  } finally {
    if (connection) connection.release();
  }
};

// =====================================================
// UPDATE PENGEMBALIAN
//
// Pending:
// Admin dan petugas boleh mengedit.
// Jika dikonfirmasi, stok ditambahkan satu kali.
//
// Selesai:
// Hanya admin boleh mengoreksi data.
// Koreksi tidak mengubah stok dan status.
// =====================================================

exports.updatePengembalian = async (req, res) => {
  const id = validId(req.params.id);
  const admin = isAdmin(req);

  const {
    tanggal_kembali,
    kondisi_kembali,
    catatan = "",
    status,
    denda: dendaInput,
  } = req.body || {};

  const kondisi = normalisasiKondisi(kondisi_kembali);
  const statusBaru = normalisasiStatus(status);

  const dendaManual =
    dendaInput === undefined ||
    dendaInput === null ||
    dendaInput === ""
      ? null
      : Number(dendaInput);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "ID pengembalian tidak valid.",
    });
  }

  if (
    !validasiTanggal(tanggal_kembali) ||
    !validasiKondisi(kondisi) ||
    !validasiCatatan(catatan)
  ) {
    return res.status(400).json({
      success: false,
      message: "Tanggal, kondisi, atau catatan tidak valid.",
    });
  }

  if (
    !["belum kembali", "dikembalikan"].includes(statusBaru)
  ) {
    return res.status(400).json({
      success: false,
      message: "Status pengembalian tidak valid.",
    });
  }

  if (dendaManual !== null && !admin) {
    return res.status(403).json({
      success: false,
      message: "Hanya admin yang boleh mengatur denda manual.",
    });
  }

  if (
    dendaManual !== null &&
    (
      !Number.isFinite(dendaManual) ||
      dendaManual < 0 ||
      dendaManual > 100000000
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Nilai denda tidak valid.",
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT
         pg.id,
         pg.peminjaman_id,
         pg.status AS status_pengembalian,
         p.tanggal_pinjam,
         p.tanggal_rencana_kembali,
         p.status AS status_peminjaman
       FROM pengembalian pg
       INNER JOIN peminjaman p
         ON p.id = pg.peminjaman_id
       WHERE pg.id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Pengembalian tidak ditemukan.",
      });
    }

    const data = rows[0];

    const statusLama = normalisasiStatus(
      data.status_pengembalian
    );

    const statusPinjam = normalisasiStatus(
      data.status_peminjaman
    );

    if (
      !validasiTanggalPengembalian(
        data.tanggal_pinjam,
        tanggal_kembali
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          "Tanggal kembali harus berada antara tanggal pinjam dan hari ini.",
      });
    }

    const perhitungan = hitungDenda(
      data.tanggal_rencana_kembali,
      tanggal_kembali,
      kondisi
    );

    const denda =
      dendaManual !== null
        ? Math.round(dendaManual)
        : perhitungan.total_denda;

    // Jika sudah selesai, hanya admin boleh melakukan koreksi.
    if (statusLama === "dikembalikan") {
      if (!admin) {
        await connection.rollback();

        return res.status(403).json({
          success: false,
          message:
            "Hanya admin yang boleh mengoreksi pengembalian selesai.",
        });
      }

      if (statusBaru !== "dikembalikan") {
        await connection.rollback();

        return res.status(409).json({
          success: false,
          message:
            "Status pengembalian selesai tidak boleh dikembalikan menjadi belum kembali.",
        });
      }

      await connection.query(
        `UPDATE pengembalian
         SET tanggal_kembali = ?,
             denda = ?,
             kondisi_kembali = ?,
             catatan = ?
         WHERE id = ?
           AND status = 'dikembalikan'`,
        [
          tanggal_kembali,
          denda,
          kondisi,
          String(catatan || "").trim() || null,
          id,
        ]
      );

      await connection.commit();

      await catatLog(
        getUserId(req),
        `Mengoreksi data pengembalian selesai ID ${id}`
      );

      return res.json({
        success: true,
        message:
          "Data pengembalian selesai berhasil dikoreksi. Stok tidak diubah.",
        data: {
          id,
          tanggal_kembali,
          kondisi_kembali: kondisi,
          denda,
          status: "dikembalikan",
          stok_dikembalikan: false,
        },
      });
    }

    if (statusLama !== "belum kembali") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Status pengembalian tidak valid.",
      });
    }

    if (statusPinjam !== "dipinjam") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message:
          "Peminjaman harus berstatus dipinjam sebelum dikonfirmasi.",
      });
    }

    if (statusBaru === "dikembalikan") {
      const [details] = await connection.query(
        `SELECT
           d.alat_id,
           d.jumlah,
           a.nama_alat
         FROM detail_peminjaman d
         INNER JOIN alat a ON a.id = d.alat_id
         WHERE d.peminjaman_id = ?
         ORDER BY d.alat_id
         FOR UPDATE`,
        [data.peminjaman_id]
      );

      if (!details.length) {
        await connection.rollback();

        return res.status(409).json({
          success: false,
          message: "Detail alat tidak ditemukan.",
        });
      }

      for (const detail of details) {
        const jumlah = Number(detail.jumlah);

        if (!Number.isInteger(jumlah) || jumlah < 1) {
          throw new Error(
            `Jumlah alat ${detail.nama_alat} tidak valid.`
          );
        }

        const [stokResult] = await connection.query(
          `UPDATE alat
           SET stok = stok + ?
           WHERE id = ?`,
          [jumlah, detail.alat_id]
        );

        if (stokResult.affectedRows !== 1) {
          throw new Error(
            `Gagal memperbarui stok ${detail.nama_alat}.`
          );
        }
      }

      const [loanUpdate] = await connection.query(
        `UPDATE peminjaman
         SET status = 'selesai'
         WHERE id = ?
           AND status = 'dipinjam'`,
        [data.peminjaman_id]
      );

      if (loanUpdate.affectedRows !== 1) {
        throw new Error("Status peminjaman gagal diperbarui.");
      }
    }

    await connection.query(
      `UPDATE pengembalian
       SET tanggal_kembali = ?,
           denda = ?,
           kondisi_kembali = ?,
           catatan = ?,
           status = ?
       WHERE id = ?
         AND status = 'belum kembali'`,
      [
        tanggal_kembali,
        denda,
        kondisi,
        String(catatan || "").trim() || null,
        statusBaru,
        id,
      ]
    );

    await connection.commit();

    await catatLog(
      getUserId(req),
      statusBaru === "dikembalikan"
        ? `Mengonfirmasi pengembalian ID ${id}. Denda Rp${denda}`
        : `Mengubah data pengembalian ID ${id}`
    );

    return res.json({
      success: true,
      message:
        statusBaru === "dikembalikan"
          ? "Pengembalian dikonfirmasi dan stok dikembalikan."
          : "Data pengembalian berhasil diperbarui.",
      data: {
        id,
        peminjaman_id: data.peminjaman_id,
        tanggal_kembali,
        kondisi_kembali: kondisi,
        hari_terlambat: perhitungan.hari_terlambat,
        denda_terlambat: perhitungan.denda_terlambat,
        denda_kerusakan: perhitungan.denda_kerusakan,
        denda,
        status: statusBaru,
        stok_dikembalikan: statusBaru === "dikembalikan",
      },
    });
  } catch (error) {
    await rollbackAman(connection);
    console.error("updatePengembalian:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui pengembalian.",
    });
  } finally {
    if (connection) connection.release();
  }
};

// =====================================================
// DELETE PENGEMBALIAN
// Hanya pengajuan belum kembali yang dapat dihapus.
// =====================================================

exports.deletePengembalian = async (req, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "ID pengembalian tidak valid.",
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, status
       FROM pengembalian
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Pengembalian tidak ditemukan.",
      });
    }

    if (
      normalisasiStatus(rows[0].status) !== "belum kembali"
    ) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message:
          "Pengembalian selesai tidak dapat dihapus agar riwayat dan stok tetap aman.",
      });
    }

    await connection.query(
      `DELETE FROM pengembalian
       WHERE id = ?
         AND status = 'belum kembali'`,
      [id]
    );

    await connection.commit();

    await catatLog(
      getUserId(req),
      `Menghapus pengajuan pengembalian ID ${id}`
    );

    return res.json({
      success: true,
      message: "Pengajuan pengembalian berhasil dihapus.",
    });
  } catch (error) {
    await rollbackAman(connection);
    console.error("deletePengembalian:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus pengembalian.",
    });
  } finally {
    if (connection) connection.release();
  }
};