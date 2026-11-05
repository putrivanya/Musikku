
const express = require("express");
const router = express.Router();

const {
  getAllAlat,
  getAlatById,
  createAlat,
  updateAlat,
  deleteAlat,
} = require("../controllers/alatController");

const {
  verifyToken,
  verifyAdmin,
} = require("../middleware/authMiddleware");

const { uploadAlatFoto } = require("../middleware/uploadAlat");

/**
 * @swagger
 * tags:
 *   name: Alat Musik
 *   description: Pengelolaan data alat musik MusikKu
 */

/**
 * @swagger
 * /api/alat:
 *   get:
 *     summary: Menampilkan seluruh alat musik
 *     tags: [Alat Musik]
 *     responses:
 *       200:
 *         description: Berhasil mengambil data alat musik
 */
router.get("/", getAllAlat);

/**
 * @swagger
 * /api/alat/{id}:
 *   get:
 *     summary: Menampilkan alat musik berdasarkan ID
 *     tags: [Alat Musik]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID alat musik
 *     responses:
 *       200:
 *         description: Data alat musik ditemukan
 *       404:
 *         description: Alat musik tidak ditemukan
 */
router.get("/:id", getAlatById);

/**
 * @swagger
 * /api/alat:
 *   post:
 *     summary: Menambahkan alat musik baru
 *     tags: [Alat Musik]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               kategori_id:
 *                 type: integer
 *               nama_alat:
 *                 type: string
 *               merk:
 *                 type: string
 *               stok:
 *                 type: integer
 *               kondisi:
 *                 type: string
 *                 enum: [baik, rusak ringan, rusak berat]
 *               keterangan:
 *                 type: string
 *               foto:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Alat musik berhasil ditambahkan
 *       401:
 *         description: Belum login
 *       403:
 *         description: Hanya admin yang dapat menambahkan alat
 */
router.post(
  "/",
  verifyToken,
  verifyAdmin,
  uploadAlatFoto,
  createAlat
);

/**
 * @swagger
 * /api/alat/{id}:
 *   put:
 *     summary: Memperbarui data alat musik
 *     tags: [Alat Musik]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               kategori_id:
 *                 type: integer
 *               nama_alat:
 *                 type: string
 *               merk:
 *                 type: string
 *               stok:
 *                 type: integer
 *               kondisi:
 *                 type: string
 *                 enum: [baik, rusak ringan, rusak berat]
 *               keterangan:
 *                 type: string
 *               foto:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Data alat berhasil diperbarui
 *       401:
 *         description: Belum login
 *       403:
 *         description: Hanya admin yang dapat memperbarui alat
 *       404:
 *         description: Alat tidak ditemukan
 */
router.put(
  "/:id",
  verifyToken,
  verifyAdmin,
  uploadAlatFoto,
  updateAlat
);

/**
 * @swagger
 * /api/alat/{id}:
 *   delete:
 *     summary: Menghapus alat musik
 *     tags: [Alat Musik]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Alat musik berhasil dihapus
 *       401:
 *         description: Belum login
 *       403:
 *         description: Hanya admin yang dapat menghapus alat
 *       404:
 *         description: Alat tidak ditemukan
 */
router.delete(
  "/:id",
  verifyToken,
  verifyAdmin,
  deleteAlat
);

module.exports = router;
