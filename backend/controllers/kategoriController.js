
const db = require("../config/database");

// GET: tampilkan kategori
async function getAllKategori(req, res, next) {
  try {
    const [rows] = await db.query(
      "SELECT id, nama_kategori, deskripsi FROM kategori ORDER BY id DESC"
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

// POST: tambah kategori
async function createKategori(req, res, next) {
  req.body = req.body || {};

  try {
    const { nama_kategori, deskripsi } = req.body;

    if (typeof nama_kategori !== "string" || !nama_kategori.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nama kategori wajib diisi.",
      });
    }

    const nama = nama_kategori.trim();

    if (nama.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Nama kategori maksimal 100 karakter.",
      });
    }

    if (
      deskripsi !== undefined &&
      deskripsi !== null &&
      (typeof deskripsi !== "string" || deskripsi.trim().length > 2000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Deskripsi maksimal 2000 karakter.",
      });
    }

    const [result] = await db.query(
      "INSERT INTO kategori (nama_kategori, deskripsi) VALUES (?, ?)",
      [nama, deskripsi?.trim() || null]
    );

    res.status(201).json({
      success: true,
      message: "Kategori berhasil ditambahkan.",
      data: {
        id: result.insertId,
        nama_kategori: nama,
        deskripsi: deskripsi?.trim() || null,
      },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Nama kategori sudah terdaftar.",
      });
    }
    next(error);
  }
}

// PUT: edit kategori
async function updateKategori(req, res, next) {
  req.body = req.body || {};

  try {
    const id = Number(req.params.id);
    const { nama_kategori, deskripsi } = req.body;

    if (
      !Number.isInteger(id) ||
      id < 1 ||
      typeof nama_kategori !== "string" ||
      !nama_kategori.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "ID dan nama kategori wajib valid.",
      });
    }

    if (nama_kategori.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Nama kategori maksimal 100 karakter.",
      });
    }

    if (
      deskripsi !== undefined &&
      deskripsi !== null &&
      (typeof deskripsi !== "string" || deskripsi.trim().length > 2000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Deskripsi maksimal 2000 karakter.",
      });
    }

    const [result] = await db.query(
      `UPDATE kategori
       SET nama_kategori = ?, deskripsi = ?
       WHERE id = ?`,
      [nama_kategori.trim(), deskripsi?.trim() || null, id]
    );

    if (result.affectedRows === 0) {
      const [rows] = await db.query(
        "SELECT id FROM kategori WHERE id = ?",
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Kategori tidak ditemukan.",
        });
      }
    }

    res.json({
      success: true,
      message: "Kategori berhasil diperbarui.",
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Nama kategori sudah digunakan.",
      });
    }
    next(error);
  }
}

// DELETE: hapus kategori
async function deleteKategori(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "ID kategori tidak valid.",
      });
    }

    const [result] = await db.query(
      "DELETE FROM kategori WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan.",
      });
    }

    res.json({
      success: true,
      message: "Kategori berhasil dihapus.",
    });
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message: "Kategori masih digunakan oleh alat musik dan tidak bisa dihapus.",
      });
    }
    next(error);
  }
}

module.exports = {
  getAllKategori,
  createKategori,
  updateKategori,
  deleteKategori,
};
