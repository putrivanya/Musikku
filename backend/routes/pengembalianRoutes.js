const express = require("express");
const router = express.Router();

const {
  verifyToken,
  verifyAdmin,
  verifyAdminOrPetugas,
  verifyAdminOrPeminjam,
} = require("../middleware/authMiddleware");

const {
  getAllPengembalian,
  getPengembalianSaya,
  createPengembalian,
  updatePengembalian,
  deletePengembalian,
} = require("../controllers/pengembalianController");

// Riwayat milik pengguna login.
router.get(
  "/saya",
  verifyToken,
  getPengembalianSaya
);

// Semua pengembalian.
router.get(
  "/",
  verifyToken,
  verifyAdminOrPetugas,
  getAllPengembalian
);

// Admin dan peminjam dapat membuat pengajuan.
router.post(
  "/",
  verifyToken,
  verifyAdminOrPeminjam,
  createPengembalian
);

// Admin dan petugas dapat memeriksa pengembalian.
router.put(
  "/:id",
  verifyToken,
  verifyAdminOrPetugas,
  updatePengembalian
);

// Penghapusan hanya admin.
router.delete(
  "/:id",
  verifyToken,
  verifyAdmin,
  deletePengembalian
);

module.exports = router;