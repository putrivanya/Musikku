
const db = require("../config/database");
const { tanggalValid } = require("../utils/validation");

exports.getAllLogAktivitas = async (req, res) => {
  try {
    const {
      search = "",
      dari = "",
      sampai = "",
    } = req.query;

    if (typeof search !== "string" || search.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Kata kunci pencarian maksimal 100 karakter.",
      });
    }

    if ((dari && !tanggalValid(dari)) || (sampai && !tanggalValid(sampai))) {
      return res.status(400).json({
        success: false,
        message: "Format tanggal filter tidak valid (YYYY-MM-DD).",
      });
    }

    if (dari && sampai && dari > sampai) {
      return res.status(400).json({
        success: false,
        message: "Tanggal awal tidak boleh melebihi tanggal akhir.",
      });
    }

    let sql = `
      SELECT
        l.id,
        l.user_id,
        COALESCE(u.nama, 'Sistem') AS nama_pengguna,
        l.aktivitas,
        l.waktu
      FROM log_aktivitas l
      LEFT JOIN users u ON u.id = l.user_id
    `;

    const conditions = [];
    const params = [];

    if (search.trim()) {
      conditions.push(`
        (
          CAST(l.id AS CHAR) LIKE ?
          OR CAST(l.user_id AS CHAR) LIKE ?
          OR l.aktivitas LIKE ?
          OR u.nama LIKE ?
        )
      `);

      const keyword = `%${search.trim()}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    if (dari) {
      conditions.push("l.waktu >= ?");
      params.push(`${dari} 00:00:00`);
    }

    if (sampai) {
      conditions.push(
        "l.waktu < DATE_ADD(?, INTERVAL 1 DAY)"
      );
      params.push(sampai);
    }

    if (conditions.length) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY l.waktu DESC, l.id DESC LIMIT 1000";

    const [rows] = await db.query(sql, params);

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("getAllLogAktivitas:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil log aktivitas.",
    });
  }
};
