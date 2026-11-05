const bcrypt = require("bcrypt");
const db = require("../config/database");
const {
  emailValid,
  usernameValid,
  passwordError,
  teks,
} = require("../utils/validation");

async function createAdmin() {
  const email = emailValid(process.env.ADMIN_EMAIL);
  const username = usernameValid(process.env.ADMIN_USERNAME);
  const password = process.env.ADMIN_PASSWORD;
  const nama = teks(process.env.ADMIN_NAME || "Administrator", 100);
  const resetPassword = process.env.ADMIN_RESET_PASSWORD === "true";

  if (!email || !username || !password || !nama) {
    console.error(
      "Isi ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD, dan ADMIN_NAME di backend/.env."
    );
    process.exitCode = 1;
    return;
  }

  const errorPassword = passwordError(password);

  if (errorPassword) {
    console.error(errorPassword);
    process.exitCode = 1;
    return;
  }

  let connection;

  try {
    connection = await db.getConnection();

    const [roles] = await connection.execute(
      "SELECT id FROM roles WHERE nama_role = ?",
      ["admin"]
    );

    if (!roles.length) {
      throw new Error("Role admin belum tersedia. Jalankan migrasi terlebih dahulu.");
    }

    const [users] = await connection.execute(
      "SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1",
      [email, username]
    );

    if (users.length > 0) {
      if (resetPassword) {
        const hash = await bcrypt.hash(password, 12);

        await connection.execute(
          `UPDATE users
           SET nama = ?,
               email = ?,
               username = ?,
               password = ?,
               role_id = ?,
               token_version = token_version + 1,
               failed_login_attempts = 0,
               locked_until = NULL
           WHERE id = ?`,
          [
            nama,
            email,
            username,
            hash,
            roles[0].id,
            users[0].id,
          ]
        );

        console.log("Akun admin diperbarui dan password direset.");
      } else {
        console.log(
          "Akun admin sudah ada. Set ADMIN_RESET_PASSWORD=true untuk mereset password."
        );
      }
    } else {
      const hash = await bcrypt.hash(password, 12);

      await connection.execute(
        `INSERT INTO users
         (nama, email, username, password, role_id)
         VALUES (?, ?, ?, ?, ?)`,
        [nama, email, username, hash, roles[0].id]
      );

      console.log("Akun admin berhasil dibuat.");
    }
  } catch (error) {
    console.error("Gagal membuat admin:", error.message);
    process.exitCode = 1;
  } finally {
    if (connection) connection.release();
    await db.end();
  }
}

createAdmin();
