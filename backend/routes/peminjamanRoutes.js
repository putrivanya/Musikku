const express = require("express");
const router = express.Router();

const controller = require("../controllers/peminjamanController");

const {
  verifyToken,
  verifyAdminOrPetugas,
  verifyAdminOrPeminjam,
} = require("../middleware/authMiddleware");

const handlerWajib = [
  "createPeminjaman",
  "getPeminjamanSaya",
  "getAllPeminjaman",
  "updateStatusPeminjaman",
  "setujuiPeminjaman",
  "tolakPeminjaman",
  "pinjamkanPeminjaman",
  "batalkanPeminjaman",
  "updatePeminjaman",
  "deletePeminjaman",
];

for (const nama of handlerWajib) {
  if (typeof controller[nama] !== "function") {
    throw new Error(
      `peminjamanController.${nama} tidak ditemukan.`
    );
  }
}

// ADMIN DAN PEMINJAM: membuat transaksi.
router.post(
  "/",
  verifyToken,
  verifyAdminOrPeminjam,
  controller.createPeminjaman
);

// Semua role yang login: melihat transaksi sendiri.
router.get(
  "/saya",
  verifyToken,
  controller.getPeminjamanSaya
);

// ADMIN DAN PETUGAS: melihat seluruh transaksi.
router.get(
  "/",
  verifyToken,
  verifyAdminOrPetugas,
  controller.getAllPeminjaman
);

// ADMIN DAN PETUGAS: mengubah status.
router.patch(
  "/:id/status",
  verifyToken,
  verifyAdminOrPetugas,
  controller.updateStatusPeminjaman
);

router.patch(
  "/:id/setujui",
  verifyToken,
  verifyAdminOrPetugas,
  controller.setujuiPeminjaman
);

router.patch(
  "/:id/tolak",
  verifyToken,
  verifyAdminOrPetugas,
  controller.tolakPeminjaman
);

router.patch(
  "/:id/pinjamkan",
  verifyToken,
  verifyAdminOrPetugas,
  controller.pinjamkanPeminjaman
);

router.patch(
  "/:id/batalkan",
  verifyToken,
  verifyAdminOrPetugas,
  controller.batalkanPeminjaman
);

// ADMIN: edit transaksi.
// PEMINJAM: edit transaksi miliknya yang masih menunggu.
router.put(
  "/:id",
  verifyToken,
  verifyAdminOrPeminjam,
  controller.updatePeminjaman
);

// ADMIN: hapus transaksi sesuai aturan status.
// PEMINJAM: hapus pengajuan miliknya sesuai aturan status.
router.delete(
  "/:id",
  verifyToken,
  verifyAdminOrPeminjam,
  controller.deletePeminjaman
);

module.exports = router;