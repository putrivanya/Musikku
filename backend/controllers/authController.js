const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const db = require("../config/database");
const env = require("../config/env");
const {
  emailValid,
  usernameValid,
  passwordError,
  teks,
} = require("../utils/validation");

const ROLE_PEMINJAM = 3;
const MAKS_PERCOBAAN_LOGIN = 5;
const DURASI_LOCK_MENIT = 15;

const roleMap = {
  1: "admin",
  2: "petugas",
  3: "peminjam",
};

// Hash dummy untuk menjaga waktu respons ketika email tidak terdaftar.
const dummyHashPromise = bcrypt.hash(
  crypto.randomBytes(16).toString("hex"),
  12
);

function pesanLoginGagal() {
  return "Email atau password salah.";
}

async function register(req, res) {
  try {
    const { nama, username, email, password } = req.body || {};

    const cleanNama = teks(nama, 100);
    const cleanUsername = usernameValid(username);
    const cleanEmail = emailValid(email);
    const errorPassword = passwordError(password);

    if (!cleanNama) {
      return res.status(400).json({
        success: false,
        message: "Nama wajib diisi (maksimal 100 karakter).",
      });
    }

    if (!cleanUsername) {
      return res.status(400).json({
        success: false,
        message:
          "Username 3-50 karakter dan hanya boleh memakai huruf, angka, titik, garis bawah, garis hubung, atau @.",
      });
    }

    if (!cleanEmail) {
      return res.status(400).json({
        success: false,
        message: "Format email tidak valid.",
      });
    }

    if (errorPassword) {
      return res.status(400).json({
        success: false,
        message: errorPassword,
      });
    }

    const [existing] = await db.execute(
      `SELECT id FROM users
       WHERE email = ? OR username = ?
       LIMIT 1`,
      [cleanEmail, cleanUsername]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email atau username sudah digunakan.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      `INSERT INTO users
       (nama, username, email, password, role_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        cleanNama,
        cleanUsername,
        cleanEmail,
        hashedPassword,
        ROLE_PEMINJAM,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Pendaftaran berhasil! Silakan login.",
      user: {
        id: result.insertId,
        nama: cleanNama,
        username: cleanUsername,
        email: cleanEmail,
        role_id: ROLE_PEMINJAM,
        role: "peminjam",
      },
    });
  } catch (error) {
    console.error("Register error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email atau username sudah digunakan.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
    });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = emailValid(email);

    if (!cleanEmail || typeof password !== "string" || !password) {
      return res.status(400).json({
        success: false,
        message: "Email dan password wajib diisi dengan benar.",
      });
    }

    const [rows] = await db.execute(
      `SELECT
         u.id,
         u.nama,
         u.username,
         u.email,
         u.password,
         u.role_id,
         u.token_version,
         u.failed_login_attempts,
         u.locked_until,
         r.nama_role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.email = ?
       LIMIT 1`,
      [cleanEmail]
    );

    if (rows.length === 0) {
      // Tetap jalankan bcrypt agar waktu respons tidak membocorkan
      // apakah email terdaftar atau tidak.
      await bcrypt.compare(password, await dummyHashPromise);

      return res.status(401).json({
        success: false,
        message: pesanLoginGagal(),
      });
    }

    const user = rows[0];
    const lockedUntil = user.locked_until
      ? new Date(user.locked_until).getTime()
      : 0;

    if (lockedUntil > Date.now()) {
      const sisaMenit = Math.max(
        1,
        Math.ceil((lockedUntil - Date.now()) / 60000)
      );

      res.setHeader("Retry-After", String(sisaMenit * 60));

      return res.status(429).json({
        success: false,
        message: `Akun terkunci sementara. Coba lagi dalam ${sisaMenit} menit.`,
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      const percobaan = Number(user.failed_login_attempts || 0) + 1;

      if (percobaan >= MAKS_PERCOBAAN_LOGIN) {
        await db.execute(
          `UPDATE users
           SET failed_login_attempts = 0,
               locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE)
           WHERE id = ?`,
          [DURASI_LOCK_MENIT, user.id]
        );
      } else {
        await db.execute(
          `UPDATE users
           SET failed_login_attempts = ?
           WHERE id = ?`,
          [percobaan, user.id]
        );
      }

      return res.status(401).json({
        success: false,
        message: pesanLoginGagal(),
      });
    }

    const roleId = Number(user.role_id);
    const role =
      String(user.nama_role || "").toLowerCase() || roleMap[roleId];

    if (!role) {
      return res.status(403).json({
        success: false,
        message: "Role akun tidak valid.",
      });
    }

    await db.execute(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL
       WHERE id = ?`,
      [user.id]
    );

    const token = jwt.sign(
      {
        id: Number(user.id),
        role_id: roleId,
        role,
        tv: Number(user.token_version || 0),
        jti: crypto.randomUUID(),
      },
      env.JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: env.JWT_EXPIRES_IN,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login berhasil.",
      token,
      user: {
        id: Number(user.id),
        nama: user.nama,
        username: user.username,
        email: user.email,
        role_id: roleId,
        role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
    });
  }
}

async function me(req, res) {
  return res.json({
    success: true,
    user: req.user,
  });
}

async function logout(req, res) {
  try {
    await db.execute(
      `UPDATE users
       SET token_version = token_version + 1,
           failed_login_attempts = 0,
           locked_until = NULL
       WHERE id = ?`,
      [req.user.id]
    );

    return res.json({
      success: true,
      message: "Logout berhasil. Sesi login telah diakhiri.",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengakhiri sesi login.",
    });
  }
}

module.exports = {
  register,
  login,
  me,
  logout,
  ROLE_PEMINJAM,
};
