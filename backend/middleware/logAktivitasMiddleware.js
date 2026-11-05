
const db = require("../config/database");

function logAktivitasMiddleware(req, res, next) {
  res.on("finish", async () => {
    try {
      // Catat hanya aktivitas yang berhasil.
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return;
      }

      const method = req.method.toUpperCase();
      const path = req.originalUrl.split("?")[0].toLowerCase();

      // Jangan mencatat pembacaan log itu sendiri.
      if (path.startsWith("/api/log-aktivitas")) {
        return;
      }

      const isLogin = /\/auth\/login\/?$/.test(path);
      const isLogout = /\/auth\/logout\/?$/.test(path);

      // Catat login/logout serta aksi yang mengubah data.
      const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

      if (!isLogin && !isLogout && !isMutation) {
        return;
      }

      let userId =
        req.user?.id ??
        req.user?.user_id ??
        req.user?.id_user ??
        req.user?.id_users ??
        null;

      let namaPengguna = "Pengguna";
      let aktivitas = "";

      if (isLogin) {
        const email = req.body?.email;

        if (email) {
          const [users] = await db.query(
            "SELECT id, nama FROM users WHERE email = ? LIMIT 1",
            [email]
          );

          if (users.length) {
            userId = users[0].id;
            namaPengguna = users[0].nama || "Pengguna";
          }
        }

        aktivitas = `LOGIN: ${namaPengguna} berhasil masuk ke sistem`;
      } else if (isLogout) {
        aktivitas = "LOGOUT: Pengguna keluar dari sistem";
      } else {
        const namaAksi = {
          POST: "MENAMBAHKAN",
          PUT: "MENGEDIT",
          PATCH: "MEMPERBARUI",
          DELETE: "MENGHAPUS",
        }[method];

        const bagianPath = req.originalUrl.split("?")[0];

        aktivitas =
          `${namaAksi}: ${bagianPath} | HTTP ${res.statusCode}`;

        if (req.user?.nama || req.user?.name) {
          namaPengguna = req.user.nama || req.user.name;
        }
      }

      // Batas panjang menyesuaikan kolom aktivitas di database (VARCHAR(1000)).
      await db.query(
        `INSERT INTO log_aktivitas (user_id, aktivitas, waktu)
         VALUES (?, ?, NOW())`,
        [
          userId || null,
          `${namaPengguna}: ${aktivitas}`.slice(0, 1000),
        ]
      );

      console.log("[AUDIT] Aktivitas tercatat:", aktivitas);
    } catch (error) {
      console.error(
        "[AUDIT] Gagal mencatat aktivitas:",
        error.message
      );
    }
  });

  next();
}

module.exports = logAktivitasMiddleware;
