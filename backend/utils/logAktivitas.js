
const db = require("../config/database");

async function catatAktivitas(userId, aktivitas) {
  try {
    const id = userId ? Number(userId) : null;
    const pesan = String(aktivitas || "").slice(0, 1000);

    const [result] = await db.query(
      `INSERT INTO log_aktivitas (user_id, aktivitas, waktu)
       VALUES (?, ?, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'))`,
      [
        Number.isInteger(id) && id > 0 ? id : null,
        pesan,
      ]
    );

    console.log(
      `[LOG] Aktivitas tersimpan. ID: ${result.insertId} | ${pesan}`
    );

    return true;
  } catch (error) {
    console.error(
      "[LOG] Gagal menyimpan aktivitas:",
      error.message
    );

    return false;
  }
}

module.exports = { catatAktivitas };
