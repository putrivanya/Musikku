
const express = require("express");
const router = express.Router();

const {
  getAllKategori,
  createKategori,
  updateKategori,
  deleteKategori
} = require("../controllers/kategoriController");

const {
  verifyToken,
  verifyAdmin
} = require("../middleware/authMiddleware");

// READ: menampilkan semua kategori
router.get("/", getAllKategori);

// CREATE: menambahkan kategori
router.post("/", verifyToken, verifyAdmin, createKategori);

// UPDATE: mengedit kategori berdasarkan ID
router.put("/:id", verifyToken, verifyAdmin, updateKategori);

// DELETE: menghapus kategori berdasarkan ID
router.delete("/:id", verifyToken, verifyAdmin, deleteKategori);

module.exports = router;
