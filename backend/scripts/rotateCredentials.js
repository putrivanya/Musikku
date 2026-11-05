/**
 * Merotasi password akun admin/petugas default satu kali.
 * Password baru ditulis ke backend/.rotated-credentials.txt (gitignored),
 * bukan ditampilkan di log.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

const db = require("../config/database");

const TARGETS = [
  {
    label: "ADMIN",
    email: process.env.ROTATE_ADMIN_EMAIL || "admin@alatmusik.test",
  },
  {
    label: "PETUGAS",
    email:
      process.env.ROTATE_PETUGAS_EMAIL || "petugas@musikku.com",
  },
];

function buatPassword(panjang = 20) {
  const huruf =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const angka = "23456789";
  const semua = `${huruf}${angka}!@#%&*`;
  const karakter = [];

  karakter.push(huruf[crypto.randomInt(huruf.length)]);
  karakter.push(angka[crypto.randomInt(angka.length)]);

  while (karakter.length < panjang) {
    karakter.push(semua[crypto.randomInt(semua.length)]);
  }

  for (let i = karakter.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [karakter[i], karakter[j]] = [karakter[j], karakter[i]];
  }

  return karakter.join("");
}

async function main() {
  const hasil = [];

  for (const target of TARGETS) {
    const [rows] = await db.execute(
      "SELECT id, email FROM users WHERE email = ? LIMIT 1",
      [target.email]
    );

    if (!rows.length) {
      console.warn(
        `Akun ${target.label} (${target.email}) tidak ditemukan; dilewati.`
      );
      continue;
    }

    const password = buatPassword();
    const hash = await bcrypt.hash(password, 12);

    await db.execute(
      `UPDATE users
       SET password = ?,
           token_version = token_version + 1,
           failed_login_attempts = 0,
           locked_until = NULL
       WHERE id = ?`,
      [hash, rows[0].id]
    );

    hasil.push({
      role: target.label,
      email: rows[0].email,
      password,
    });

    console.log(`Password ${target.label} berhasil dirotasi.`);
  }

  if (!hasil.length) {
    throw new Error("Tidak ada akun yang dirotasi.");
  }

  const file = path.join(__dirname, "..", ".rotated-credentials.txt");
  const isi = [
    "KREDENSIAL BARU MUSIKKU",
    `Dibuat: ${new Date().toISOString()}`,
    "",
    "Simpan ke password manager, lalu hapus file ini.",
    "Setelah login, segera ganti password melalui menu User.",
    "",
    ...hasil.map(
      (item) =>
        `${item.role}\nEmail    : ${item.email}\nPassword : ${item.password}\n`
    ),
  ].join("\n");

  fs.writeFileSync(file, isi, {
    encoding: "utf8",
    mode: 0o600,
    flag: "w",
  });

  console.log(`Kredensial baru disimpan di: ${file}`);
}

main()
  .catch((error) => {
    console.error("Rotasi gagal:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
