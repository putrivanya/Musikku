/**
 * Pemeriksaan integritas database setelah migrasi.
 * Jalankan: node scripts/dbSanityCheck.js
 */
const db = require("../config/database");

async function main() {
  const checks = [];
  const [negatif] = await db.query(
    "SELECT COUNT(*) AS total FROM alat WHERE stok < 0"
  );
  const [detailInvalid] = await db.query(
    "SELECT COUNT(*) AS total FROM detail_peminjaman WHERE jumlah < 1"
  );
  const [dendaNegatif] = await db.query(
    "SELECT COUNT(*) AS total FROM pengembalian WHERE denda < 0"
  );
  const [emailDuplikat] = await db.query(`
    SELECT COUNT(*) AS total
    FROM (
      SELECT email
      FROM users
      WHERE email IS NOT NULL
      GROUP BY email
      HAVING COUNT(*) > 1
    ) AS duplikat
  `);
  const [tanpaRole] = await db.query(`
    SELECT COUNT(*) AS total
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE r.id IS NULL
  `);
  const [sisaUji] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE email LIKE '%@musikku.local') AS users,
      (SELECT COUNT(*) FROM alat WHERE nama_alat LIKE 'Smoke %' OR nama_alat LIKE 'Stok Smoke %') AS alat,
      (SELECT COUNT(*) FROM kategori WHERE nama_kategori LIKE 'Kategori Stok %' OR nama_kategori LIKE 'Smoke Upload %') AS kategori
  `);

  checks.push(["Stok alat tidak negatif", Number(negatif[0].total) === 0]);
  checks.push([
    "Jumlah detail peminjaman valid",
    Number(detailInvalid[0].total) === 0,
  ]);
  checks.push([
    "Denda tidak negatif",
    Number(dendaNegatif[0].total) === 0,
  ]);
  checks.push([
    "Email tidak duplikat",
    Number(emailDuplikat[0].total) === 0,
  ]);
  checks.push([
    "Semua user memiliki role valid",
    Number(tanpaRole[0].total) === 0,
  ]);

  for (const [label, lulus] of checks) {
    console.log(`${lulus ? "PASS" : "FAIL"} ${label}`);
    if (!lulus) process.exitCode = 1;
  }

  console.log("Sisa data uji:", sisaUji[0]);

  await db.end();
}

main().catch((error) => {
  console.error("Pemeriksaan database gagal:", error.message);
  process.exit(1);
});
