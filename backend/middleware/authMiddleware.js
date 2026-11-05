const jwt = require("jsonwebtoken");
const db = require("../config/database");
const env = require("../config/env");

const ROLE_NAMA = {
  1: "admin",
  2: "petugas",
  3: "peminjam",
};

function rolePengguna(user) {
  return String(
    user?.role ||
    ROLE_NAMA[Number(user?.role_id)] ||
    ""
  ).trim().toLowerCase();
}

async function verifyToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Token login tidak ditemukan.",
    });
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token login tidak ditemukan.",
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    const userId = Number(decoded.id);

    if (!Number.isInteger(userId) || userId < 1) {
      return res.status(401).json({
        success: false,
        message: "Token tidak valid.",
      });
    }

    const [rows] = await db.execute(
      `SELECT
        u.id,
        u.nama,
        u.username,
        u.email,
        u.role_id,
        u.token_version,
        r.nama_role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "Akun tidak ditemukan. Silakan login kembali.",
      });
    }

    const user = rows[0];

    if (
      Number(decoded.tv) !==
      Number(user.token_version)
    ) {
      return res.status(401).json({
        success: false,
        message: "Sesi sudah berakhir. Silakan login kembali.",
      });
    }

    req.user = {
      id: Number(user.id),
      nama: user.nama,
      username: user.username,
      email: user.email,
      role_id: Number(user.role_id),
      role:
        String(user.nama_role || "").toLowerCase() ||
        ROLE_NAMA[Number(user.role_id)],
      token_version: Number(user.token_version),
    };

    return next();
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          error.name === "TokenExpiredError"
            ? "Token sudah kedaluwarsa. Silakan login kembali."
            : "Token tidak valid.",
      });
    }

    console.error("verifyToken:", error);

    return res.status(503).json({
      success: false,
      message: "Layanan autentikasi sedang tidak tersedia.",
    });
  }
}

function verifyRoles(...roles) {
  const diizinkan = roles.map((role) =>
    String(role).toLowerCase()
  );

  return function roleGuard(req, res, next) {
    if (!diizinkan.includes(rolePengguna(req.user))) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak. Role akun tidak diizinkan.",
      });
    }

    return next();
  };
}

const verifyAdmin = verifyRoles("admin");
const verifyPetugas = verifyRoles("petugas");
const verifyPeminjam = verifyRoles("peminjam");

const verifyAdminOrPetugas = verifyRoles(
  "admin",
  "petugas"
);

const verifyAdminOrPeminjam = verifyRoles(
  "admin",
  "peminjam"
);

module.exports = {
  verifyToken,
  verifyRoles,
  verifyAdmin,
  verifyPetugas,
  verifyPeminjam,
  verifyAdminOrPetugas,
  verifyAdminOrPeminjam,
  rolePengguna,
};