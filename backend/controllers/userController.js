const db = require("../config/database");
const bcrypt = require("bcrypt");
const {
  teks,
  emailValid,
  usernameValid,
  passwordError,
} = require("../utils/validation");

const ROLE_VALID = [1, 2, 3];

function normalisasiUserInput(body) {
  const nama = teks(body?.nama, 100);
  const username = usernameValid(body?.username);
  const email = emailValid(body?.email);
  const roleId = Number(body?.role_id);

  if (!nama) {
    return { error: "Nama wajib diisi (maksimal 100 karakter)." };
  }

  if (!username) {
    return {
      error:
        "Username 3-50 karakter dan hanya boleh memakai huruf, angka, titik, garis bawah, garis hubung, atau @.",
    };
  }

  if (!email) {
    return { error: "Format email tidak valid." };
  }

  if (!ROLE_VALID.includes(roleId)) {
    return { error: "Role tidak valid." };
  }

  return { nama, username, email, roleId };
}

async function getUsers(req, res) {
  try {
    const [users] = await db.execute(`
      SELECT
        u.id,
        u.nama,
        u.username,
        u.email,
        u.role_id,
        r.nama_role AS role
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY u.id DESC
    `);

    return res.json({ success: true, data: users });
  } catch (error) {
    console.error("Get users:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data pengguna.",
    });
  }
}

async function createUser(req, res) {
  try {
    const input = normalisasiUserInput(req.body);

    if (input.error) {
      return res.status(400).json({
        success: false,
        message: input.error,
      });
    }

    const errorPassword = passwordError(req.body?.password);

    if (errorPassword) {
      return res.status(400).json({
        success: false,
        message: errorPassword,
      });
    }

    const [existing] = await db.execute(
      "SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1",
      [input.email, input.username]
    );

    if (existing.length) {
      return res.status(409).json({
        success: false,
        message: "Email atau username sudah digunakan.",
      });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 12);

    const [result] = await db.execute(
      `INSERT INTO users (nama, username, email, password, role_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.nama,
        input.username,
        input.email,
        hashedPassword,
        input.roleId,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Pengguna berhasil ditambahkan.",
      data: {
        id: result.insertId,
        nama: input.nama,
        username: input.username,
        email: input.email,
        role_id: input.roleId,
      },
    });
  } catch (error) {
    console.error("Create user:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email atau username sudah digunakan.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Gagal menambahkan pengguna.",
    });
  }
}

async function updateUser(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "ID pengguna tidak valid.",
      });
    }

    const input = normalisasiUserInput(req.body);

    if (input.error) {
      return res.status(400).json({
        success: false,
        message: input.error,
      });
    }

    const [targetRows] = await db.execute(
      "SELECT id, role_id FROM users WHERE id = ? LIMIT 1",
      [id]
    );

    if (!targetRows.length) {
      return res.status(404).json({
        success: false,
        message: "Pengguna tidak ditemukan.",
      });
    }

    const target = targetRows[0];

    if (id === Number(req.user.id) && input.roleId !== 1) {
      return res.status(400).json({
        success: false,
        message:
          "Role akun admin yang sedang digunakan tidak boleh diubah.",
      });
    }

    if (Number(target.role_id) === 1 && input.roleId !== 1) {
      const [[{ total }]] = await db.execute(
        "SELECT COUNT(*) AS total FROM users WHERE role_id = 1"
      );

      if (Number(total) <= 1) {
        return res.status(400).json({
          success: false,
          message: "Admin terakhir tidak boleh diturunkan rolenya.",
        });
      }
    }

    const [duplicates] = await db.execute(
      "SELECT id FROM users WHERE (email = ? OR username = ?) AND id <> ? LIMIT 1",
      [input.email, input.username, id]
    );

    if (duplicates.length) {
      return res.status(409).json({
        success: false,
        message: "Email atau username sudah digunakan akun lain.",
      });
    }

    const passwordBaru =
      typeof req.body?.password === "string" && req.body.password !== ""
        ? req.body.password
        : null;

    if (passwordBaru) {
      const errorPassword = passwordError(passwordBaru);

      if (errorPassword) {
        return res.status(400).json({
          success: false,
          message: errorPassword,
        });
      }
    }

    const roleBerubah = Number(target.role_id) !== input.roleId;
    const harusCabutSesi = Boolean(passwordBaru) || roleBerubah;

    if (passwordBaru) {
      const hashedPassword = await bcrypt.hash(passwordBaru, 12);

      await db.execute(
        `UPDATE users
         SET nama = ?,
             username = ?,
             email = ?,
             password = ?,
             role_id = ?,
             token_version = token_version + ?
         WHERE id = ?`,
        [
          input.nama,
          input.username,
          input.email,
          hashedPassword,
          input.roleId,
          harusCabutSesi ? 1 : 0,
          id,
        ]
      );
    } else {
      await db.execute(
        `UPDATE users
         SET nama = ?,
             username = ?,
             email = ?,
             role_id = ?,
             token_version = token_version + ?
         WHERE id = ?`,
        [
          input.nama,
          input.username,
          input.email,
          input.roleId,
          harusCabutSesi ? 1 : 0,
          id,
        ]
      );
    }

    return res.json({
      success: true,
      message: harusCabutSesi
        ? "Data pengguna diperbarui. Sesi login pengguna tersebut telah diakhiri."
        : "Data pengguna berhasil diperbarui.",
    });
  } catch (error) {
    console.error("Update user:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email atau username sudah digunakan.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui pengguna.",
    });
  }
}

async function deleteUser(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "ID pengguna tidak valid.",
      });
    }

    if (id === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message:
          "Kamu tidak dapat menghapus akun admin yang sedang digunakan.",
      });
    }

    const [rows] = await db.execute(
      "SELECT id, role_id FROM users WHERE id = ? LIMIT 1",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Pengguna tidak ditemukan.",
      });
    }

    if (Number(rows[0].role_id) === 1) {
      const [[{ total }]] = await db.execute(
        "SELECT COUNT(*) AS total FROM users WHERE role_id = 1"
      );

      if (Number(total) <= 1) {
        return res.status(400).json({
          success: false,
          message: "Admin terakhir tidak boleh dihapus.",
        });
      }
    }

    await db.execute("DELETE FROM users WHERE id = ?", [id]);

    return res.json({
      success: true,
      message: "Pengguna berhasil dihapus.",
    });
  } catch (error) {
    console.error("Delete user:", error);

    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message:
          "Pengguna memiliki riwayat transaksi. Data tidak dapat dihapus karena terkait transaksi.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus pengguna.",
    });
  }
}

module.exports = { getUsers, createUser, updateUser, deleteUser };
