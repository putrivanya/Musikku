
const db = require("../config/database");
const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "../uploads/alat");

function hapusFileFoto(namaFile) {
  if (!namaFile) return;

  // Hanya menghapus nama file, bukan path sembarang.
  const aman = path.basename(namaFile);
  const filePath = path.join(uploadDir, aman);

  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Gagal menghapus foto:", err.message);
    }
  });
}

function validasiAlat(body) {
  const {
    kategori_id,
    nama_alat,
    merk,
    stok,
    kondisi,
    keterangan,
  } = body || {};

  if (!kategori_id || !nama_alat || stok === undefined || !kondisi) {
    return "Kategori, nama alat, stok, dan kondisi wajib diisi.";
  }

  if (!Number.isInteger(Number(kategori_id)) || Number(kategori_id) < 1) {
    return "ID kategori tidak valid.";
  }

  if (
    !Number.isInteger(Number(stok)) ||
    Number(stok) < 0 ||
    Number(stok) > 100_000
  ) {
    return "Stok harus berupa bilangan bulat antara 0 dan 100.000.";
  }

  const kondisiValid = ["baik", "rusak ringan", "rusak berat"];

  if (!kondisiValid.includes(String(kondisi).trim().toLowerCase())) {
    return "Pilihan kondisi alat tidak valid.";
  }

  if (
    typeof nama_alat !== "string" ||
    !nama_alat.trim() ||
    nama_alat.trim().length > 100
  ) {
    return "Nama alat wajib diisi dan maksimal 100 karakter.";
  }

  if (
    merk !== undefined &&
    merk !== null &&
    (typeof merk !== "string" || merk.trim().length > 100)
  ) {
    return "Merk maksimal 100 karakter.";
  }

  if (
    keterangan !== undefined &&
    keterangan !== null &&
    (typeof keterangan !== "string" ||
      keterangan.trim().length > 2000)
  ) {
    return "Keterangan maksimal 2000 karakter.";
  }

  return null;
}

// GET semua alat
async function getAllAlat(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT
        a.id,
        a.kategori_id,
        a.nama_alat,
        a.merk,
        a.stok,
        a.kondisi,
        a.keterangan,
        a.foto,
        k.nama_kategori
      FROM alat a
      LEFT JOIN kategori k ON k.id = a.kategori_id
      ORDER BY a.id DESC
    `);

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("getAllAlat:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data alat musik.",
    });
  }
}

// GET satu alat
async function getAlatById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "ID alat tidak valid.",
      });
    }

    const [rows] = await db.query(
      `SELECT a.*, k.nama_kategori
       FROM alat a
       LEFT JOIN kategori k ON k.id = a.kategori_id
       WHERE a.id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Alat musik tidak ditemukan.",
      });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("getAlatById:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil detail alat musik.",
    });
  }
}

// POST tambah alat dan foto
async function createAlat(req, res) {
  let fotoTersimpan = req.file?.filename || null;

  try {
    const body = req.body || {};
    const errorValidasi = validasiAlat(body);

    if (errorValidasi) {
      if (fotoTersimpan) hapusFileFoto(fotoTersimpan);

      return res.status(400).json({
        success: false,
        message: errorValidasi,
      });
    }

    const {
      kategori_id,
      nama_alat,
      merk,
      stok,
      kondisi,
      keterangan,
    } = body;

    const kondisiBersih = String(kondisi).trim().toLowerCase();

    const [kategori] = await db.query(
      "SELECT id FROM kategori WHERE id = ?",
      [Number(kategori_id)]
    );

    if (!kategori.length) {
      if (fotoTersimpan) hapusFileFoto(fotoTersimpan);

      return res.status(400).json({
        success: false,
        message: "Kategori yang dipilih tidak ditemukan.",
      });
    }

    const [result] = await db.query(
      `INSERT INTO alat
        (kategori_id, nama_alat, merk, stok, kondisi, keterangan, foto)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(kategori_id),
        String(nama_alat).trim(),
        merk?.trim() || null,
        Number(stok),
        kondisiBersih,
        keterangan?.trim() || null,
        fotoTersimpan,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Alat musik berhasil ditambahkan.",
      data: {
        id: result.insertId,
        kategori_id: Number(kategori_id),
        nama_alat: String(nama_alat).trim(),
        merk: merk?.trim() || null,
        stok: Number(stok),
        kondisi: kondisiBersih,
        keterangan: keterangan?.trim() || null,
        foto: fotoTersimpan,
      },
    });
  } catch (error) {
    console.error("createAlat:", error);

    if (fotoTersimpan) hapusFileFoto(fotoTersimpan);

    return res.status(500).json({
      success: false,
      message: "Gagal menyimpan alat musik. Periksa struktur tabel dan terminal backend.",
    });
  }
}

// PUT edit alat dan foto
async function updateAlat(req, res) {
  let fotoBaru = req.file?.filename || null;

  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      if (fotoBaru) hapusFileFoto(fotoBaru);

      return res.status(400).json({
        success: false,
        message: "ID alat tidak valid.",
      });
    }

    const [lama] = await db.query(
      "SELECT * FROM alat WHERE id = ?",
      [id]
    );

    if (!lama.length) {
      if (fotoBaru) hapusFileFoto(fotoBaru);

      return res.status(404).json({
        success: false,
        message: "Alat musik tidak ditemukan.",
      });
    }

    const body = req.body || {};
    const errorValidasi = validasiAlat(body);

    if (errorValidasi) {
      if (fotoBaru) hapusFileFoto(fotoBaru);

      return res.status(400).json({
        success: false,
        message: errorValidasi,
      });
    }

    const {
      kategori_id,
      nama_alat,
      merk,
      stok,
      kondisi,
      keterangan,
    } = body;

    const kondisiBersih = String(kondisi).trim().toLowerCase();

    const [kategori] = await db.query(
      "SELECT id FROM kategori WHERE id = ?",
      [Number(kategori_id)]
    );

    if (!kategori.length) {
      if (fotoBaru) hapusFileFoto(fotoBaru);

      return res.status(400).json({
        success: false,
        message: "Kategori yang dipilih tidak ditemukan.",
      });
    }

    const fotoFinal = fotoBaru || lama[0].foto || null;

    await db.query(
      `UPDATE alat SET
        kategori_id = ?,
        nama_alat = ?,
        merk = ?,
        stok = ?,
        kondisi = ?,
        keterangan = ?,
        foto = ?
       WHERE id = ?`,
      [
        Number(kategori_id),
        String(nama_alat).trim(),
        merk?.trim() || null,
        Number(stok),
        kondisiBersih,
        keterangan?.trim() || null,
        fotoFinal,
        id,
      ]
    );

    if (fotoBaru && lama[0].foto && fotoBaru !== lama[0].foto) {
      hapusFileFoto(lama[0].foto);
    }

    return res.json({
      success: true,
      message: "Data alat musik berhasil diperbarui.",
      data: {
        ...lama[0],
        ...body,
        id,
        foto: fotoFinal,
      },
    });
  } catch (error) {
    console.error("updateAlat:", error);

    if (fotoBaru) hapusFileFoto(fotoBaru);

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui alat musik. Periksa struktur tabel dan terminal backend.",
    });
  }
}

// DELETE alat
async function deleteAlat(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "ID alat tidak valid.",
      });
    }

    const [rows] = await db.query(
      "SELECT id, foto FROM alat WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Alat musik tidak ditemukan.",
      });
    }

    const [aktif] = await db.query(
      `SELECT COUNT(*) AS total
       FROM detail_peminjaman d
       JOIN peminjaman p ON p.id = d.peminjaman_id
       WHERE d.alat_id = ?
         AND p.status IN ('disetujui', 'dipinjam')`,
      [id]
    );

    if (Number(aktif[0].total) > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Alat tidak dapat dihapus karena masih digunakan pada peminjaman aktif.",
      });
    }

    await db.query("DELETE FROM alat WHERE id = ?", [id]);

    if (rows[0].foto) hapusFileFoto(rows[0].foto);

    return res.json({
      success: true,
      message: "Alat musik berhasil dihapus.",
    });
  } catch (error) {
    console.error("deleteAlat:", error);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message: "Alat tidak bisa dihapus karena sudah digunakan dalam peminjaman.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus alat musik.",
    });
  }
}

module.exports = {
  getAllAlat,
  getAlatById,
  createAlat,
  updateAlat,
  deleteAlat,
};
