const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const sharp = require("sharp");

const env = require("../config/env");

const uploadDir = path.join(__dirname, "../uploads/alat");

fs.mkdirSync(uploadDir, { recursive: true });

function deteksiTipeGambar(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.UPLOAD_MAX_BYTES,
    files: 1,
    fields: 20,
  },
  fileFilter: (req, file, cb) => {
    const mimeDiizinkan = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!mimeDiizinkan.includes(String(file.mimetype).toLowerCase())) {
      const error = new Error(
        "Foto harus berupa gambar JPG, PNG, atau WebP."
      );
      error.status = 400;
      return cb(error);
    }

    return cb(null, true);
  },
}).single("foto");

function uploadAlatFoto(req, res, next) {
  upload(req, res, async (error) => {
    if (error) return next(error);

    if (!req.file) return next();

    const tipe = deteksiTipeGambar(req.file.buffer);

    if (!tipe) {
      return res.status(400).json({
        success: false,
        message: "Isi file bukan gambar yang valid.",
      });
    }

    const namaFile = `alat-${crypto.randomUUID()}.webp`;
    const tujuan = path.join(uploadDir, namaFile);

    try {
      // Re-encode menghapus metadata/EXIF dan memastikan isi file
      // benar-benar gambar, bukan polyglot atau skrip.
      const hasil = await sharp(req.file.buffer, {
        failOn: "error",
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize({
          width: 2000,
          height: 2000,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();

      await fs.promises.writeFile(tujuan, hasil, { flag: "wx" });

      req.file.filename = namaFile;
      req.file.path = tujuan;
      req.file.mimetype = "image/webp";
      req.file.size = hasil.length;

      return next();
    } catch (err) {
      console.error("Gagal memproses foto alat:", err.message);

      return res.status(400).json({
        success: false,
        message: "Foto tidak dapat diproses. Gunakan gambar yang valid.",
      });
    }
  });
}

module.exports = {
  uploadAlatFoto,
  uploadDir,
  deteksiTipeGambar,
};
