/**
 * Uji integritas stok end-to-end:
 * pengajuan -> setujui (stok turun) -> batal (stok naik) -> setujui ->
 * pinjamkan -> ajukan kembali -> konfirmasi petugas (stok naik tepat sekali).
 *
 * Data uji dibuat dengan nama unik lalu dibersihkan langsung dari database.
 * Jalankan saat backend aktif: node scripts/stockSmokeTest.js
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const db = require("../config/database");

const BASE = process.env.API_URL || "http://localhost:5000/api";

function bacaKredensial() {
  const file = path.join(__dirname, "..", ".rotated-credentials.txt");
  const isi = fs.readFileSync(file, "utf8");

  return Object.fromEntries(
    isi
      .split(/\n(?=[A-Z]+\n)/)
      .map((blok) => {
        const role = blok.match(/^([A-Z]+)\n/)?.[1]?.toLowerCase();
        const email = blok.match(/Email\s*:\s*(.+)/)?.[1]?.trim();
        const password = blok.match(/Password\s*:\s*(.+)/)?.[1]?.trim();

        return role ? [role, { email, password }] : null;
      })
      .filter(Boolean)
  );
}

async function request(method, endpoint, { token, body } = {}) {
  const headers = { Accept: "application/json" };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${BASE}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  return { status: response.status, data };
}

function assert(condition, label, detail = "") {
  if (condition) {
    console.log(`PASS ${label}`);
    return;
  }

  console.error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  process.exitCode = 1;
}

function tanggalLokal(offsetHari = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetHari);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

async function main() {
  const akun = bacaKredensial();
  const suffix = crypto.randomBytes(4).toString("hex");
  const namaAlat = `Stok Smoke ${suffix}`;
  const namaKategori = `Kategori Stok ${suffix}`;
  const emailPeminjam = `stok.test.${suffix}@musikku.local`;
  const usernamePeminjam = `stoktest${suffix}`;
  const passwordPeminjam = `Stok${suffix}Aa1!`;

  let adminToken = null;
  let petugasToken = null;
  let peminjamToken = null;
  let kategoriId = null;
  let alatId = null;
  let userId = null;
  const loanIds = [];

  const loginAdmin = await request("POST", "/auth/login", {
    body: akun.admin,
  });
  const loginPetugas = await request("POST", "/auth/login", {
    body: akun.petugas,
  });

  assert(loginAdmin.status === 200, "Admin login untuk uji stok");
  assert(loginPetugas.status === 200, "Petugas login untuk uji stok");

  adminToken = loginAdmin.data.token;
  petugasToken = loginPetugas.data.token;

  if (!adminToken || !petugasToken) return;

  try {
    const kategori = await request("POST", "/kategori", {
      token: adminToken,
      body: {
        nama_kategori: namaKategori,
        deskripsi: "Kategori sementara uji stok.",
      },
    });

    kategoriId = kategori.data.data?.id;

    assert(kategori.status === 201, "Kategori uji dibuat");

    const alat = await request("POST", "/alat", {
      token: adminToken,
      body: {
        kategori_id: kategoriId,
        nama_alat: namaAlat,
        merk: "Test",
        stok: 2,
        kondisi: "baik",
        keterangan: "Data sementara uji stok.",
      },
    });

    alatId = alat.data.data?.id;

    assert(
      alat.status === 201 && Number(alat.data.data?.stok) === 2,
      "Alat uji dibuat dengan stok 2"
    );

    const user = await request("POST", "/users", {
      token: adminToken,
      body: {
        nama: "Peminjam Uji Stok",
        username: usernamePeminjam,
        email: emailPeminjam,
        password: passwordPeminjam,
        role_id: 3,
      },
    });

    userId = user.data.data?.id;

    assert(user.status === 201, "Peminjam uji dibuat");

    const loginPeminjam = await request("POST", "/auth/login", {
      body: { email: emailPeminjam, password: passwordPeminjam },
    });

    peminjamToken = loginPeminjam.data.token;

    assert(
      loginPeminjam.status === 200 && Boolean(peminjamToken),
      "Peminjam uji login"
    );

    async function buatPengajuan() {
      const result = await request("POST", "/peminjaman", {
        token: peminjamToken,
        body: {
          tanggal_pinjam: tanggalLokal(0),
          tanggal_rencana_kembali: tanggalLokal(1),
          jaminan: "KTP",
          catatan: "Uji stok otomatis.",
          items: [{ alat_id: alatId, jumlah: 1 }],
        },
      });

      if (result.data.data?.id) loanIds.push(result.data.data.id);

      return result;
    }

    async function stokAlat() {
      const result = await request("GET", `/alat/${alatId}`);

      return Number(result.data.data?.stok);
    }

    const pengajuan1 = await buatPengajuan();

    assert(
      pengajuan1.status === 201,
      "Pengajuan pertama berhasil",
      `${pengajuan1.status} ${pengajuan1.data.message || ""}`
    );

    const pinjamId1 = pengajuan1.data.data?.id;

    const setujui1 = await request(
      "PATCH",
      `/peminjaman/${pinjamId1}/setujui`,
      { token: adminToken, body: {} }
    );

    assert(setujui1.status === 200, "Admin menyetujui pengajuan pertama");
    assert((await stokAlat()) === 1, "Stok menjadi 1 setelah disetujui");

    const batal1 = await request(
      "PATCH",
      `/peminjaman/${pinjamId1}/batalkan`,
      { token: adminToken, body: {} }
    );

    assert(batal1.status === 200, "Admin membatalkan pengajuan pertama");
    assert(
      (await stokAlat()) === 2,
      "Stok kembali 2 setelah pembatalan"
    );

    const pengajuan2 = await buatPengajuan();

    assert(pengajuan2.status === 201, "Pengajuan kedua berhasil");

    const pinjamId2 = pengajuan2.data.data?.id;

    const setujui2 = await request(
      "PATCH",
      `/peminjaman/${pinjamId2}/setujui`,
      { token: adminToken, body: {} }
    );

    assert(setujui2.status === 200, "Admin menyetujui pengajuan kedua");
    assert((await stokAlat()) === 1, "Stok menjadi 1 setelah disetujui");

    const serah = await request(
      "PATCH",
      `/peminjaman/${pinjamId2}/pinjamkan`,
      { token: adminToken, body: {} }
    );

    assert(serah.status === 200, "Admin menyerahkan alat");
    assert(
      (await stokAlat()) === 1,
      "Stok tidak berubah saat alat diserahkan"
    );

    const kembali = await request("POST", "/pengembalian", {
      token: peminjamToken,
      body: {
        peminjaman_id: pinjamId2,
        tanggal_kembali: tanggalLokal(0),
        kondisi_kembali: "baik",
        catatan: "Uji pengembalian otomatis.",
      },
    });

    assert(kembali.status === 201, "Peminjam mengajukan pengembalian");
    assert(
      (await stokAlat()) === 1,
      "Stok belum berubah sebelum konfirmasi"
    );

    const pengembalianId = kembali.data.data?.id;

    const konfirmasi = await request(
      "PUT",
      `/pengembalian/${pengembalianId}`,
      {
        token: petugasToken,
        body: {
          tanggal_kembali: tanggalLokal(0),
          kondisi_kembali: "baik",
          catatan: "Dikonfirmasi petugas.",
          status: "dikembalikan",
        },
      }
    );

    assert(
      konfirmasi.status === 200,
      "Petugas mengonfirmasi pengembalian",
      `${konfirmasi.status} ${konfirmasi.data.message || ""}`
    );
    assert(
      (await stokAlat()) === 2,
      "Stok kembali 2 setelah pengembalian dikonfirmasi"
    );

    const konfirmasiUlang = await request(
      "PUT",
      `/pengembalian/${pengembalianId}`,
      {
        token: petugasToken,
        body: {
          tanggal_kembali: tanggalLokal(0),
          kondisi_kembali: "baik",
          catatan: "Percobaan konfirmasi ulang.",
          status: "dikembalikan",
        },
      }
    );

    assert(
      konfirmasiUlang.status === 409,
      "Konfirmasi ulang ditolak agar stok tidak bertambah dua kali"
    );
    assert(
      (await stokAlat()) === 2,
      "Stok tetap 2 setelah percobaan konfirmasi ulang"
    );
  } finally {
    try {
      for (const id of loanIds) {
        await db.execute("DELETE FROM pengembalian WHERE peminjaman_id = ?", [
          id,
        ]);
        await db.execute(
          "DELETE FROM detail_peminjaman WHERE peminjaman_id = ?",
          [id]
        );
        await db.execute("DELETE FROM peminjaman WHERE id = ?", [id]);
      }

      if (userId) {
        await db.execute("DELETE FROM log_aktivitas WHERE user_id = ?", [
          userId,
        ]);
        await db.execute("DELETE FROM users WHERE id = ?", [userId]);
      }

      if (alatId) await db.execute("DELETE FROM alat WHERE id = ?", [alatId]);
      if (kategoriId) {
        await db.execute("DELETE FROM kategori WHERE id = ?", [kategoriId]);
      }

      console.log("PASS Data uji stok dibersihkan");
    } catch (error) {
      console.error("Gagal membersihkan data uji stok:", error.message);
      process.exitCode = 1;
    }

    if (peminjamToken) {
      await request("POST", "/auth/logout", { token: peminjamToken });
    }
    if (adminToken) {
      await request("POST", "/auth/logout", { token: adminToken });
    }
    if (petugasToken) {
      await request("POST", "/auth/logout", { token: petugasToken });
    }

    await db.end();
  }
}

main().catch((error) => {
  console.error("Uji stok gagal:", error.message);
  process.exit(1);
});
