const bcrypt = require("bcrypt");
const db = require("./config/database");
const {
  emailValid,
  usernameValid,
  passwordError,
  teks,
} = require("./utils/validation");

async function buatPetugas() {
  const email = emailValid(process.env.PETUGAS_EMAIL);
  const username = usernameValid(process.env.PETUGAS_USERNAME);
  const password = process.env.PETUGAS_PASSWORD;
  const nama = teks(process.env.PETUGAS_NAME || "Petugas MusikKu", 100);
  const resetPassword = process.env.PETUGAS_RESET_PASSWORD === "true";

  if (!email || !username || !password || !nama) {
    console.error(
      "Isi PETUGAS_EMAIL, PETUGAS_USERNAME, PETUGAS_PASSWORD, dan PETUGAS_NAME di backend/.env."
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

  try {
    const [roles] = await db.execute(
      "SELECT id FROM roles WHERE nama_role = ?",
      ["petugas"]
    );

    if (!roles.length) {
      throw new Error(
        "Role petugas belum tersedia. Jalankan migrasi terlebih dahulu."
      );
    }

    const [users] = await db.execute(
      "SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1",
      [email, username]
    );

    if (users.length > 0) {
      if (resetPassword) {
        const hash = await bcrypt.hash(password, 12);

        await db.execute(
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

        console.log("Akun petugas diperbarui dan password direset.");
      } else {
        console.log(
          "Akun petugas sudah ada. Set PETUGAS_RESET_PASSWORD=true untuk mereset password."
        );
      }
    } else {
      const hash = await bcrypt.hash(password, 12);

      await db.execute(
        `INSERT INTO users
         (nama, username, email, password, role_id)
         VALUES (?, ?, ?, ?, ?)`,
        [nama, username, email, hash, roles[0].id]
      );

      console.log("Akun petugas berhasil dibuat.");
    }
  } catch (error) {
    console.error("Gagal membuat akun petugas:", error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

buatPetugas();
