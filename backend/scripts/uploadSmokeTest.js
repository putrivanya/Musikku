/**
 * Smoke test upload foto alat:
 * - gambar PNG valid harus di-re-encode menjadi .webp
 * - file palsu (bukan gambar) harus ditolak
 *
 * Jalankan saat backend aktif: node scripts/uploadSmokeTest.js
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const BASE = process.env.API_URL || "http://localhost:5000/api";
const SERVER = BASE.replace(/\/api$/, "");

function bacaKredensialAdmin() {
  const file = path.join(__dirname, "..", ".rotated-credentials.txt");
  const isi = fs.readFileSync(file, "utf8");
  const blok = isi
    .split(/\n(?=[A-Z]+\n)/)
    .find((bagian) => bagian.startsWith("ADMIN\n"));

  if (!blok) throw new Error("Kredensial admin tidak ditemukan.");

  return {
    email: blok.match(/Email\s*:\s*(.+)/)?.[1]?.trim(),
    password: blok.match(/Password\s*:\s*(.+)/)?.[1]?.trim(),
  };
}

async function requestJson(method, endpoint, { token, body } = {}) {
  const headers = { Accept: "application/json" };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${BASE}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    // abaikan respons non-JSON
  }

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

async function main() {
  const admin = bacaKredensialAdmin();
  const login = await requestJson("POST", "/auth/login", {
    body: admin,
  });

  assert(login.status === 200, "Admin dapat login untuk uji upload");
  if (login.status !== 200) return;

  const token = login.data.token;
  const suffix = crypto.randomBytes(4).toString("hex");

  let kategoriId = null;
  let kategoriDibuat = null;
  const kategori = await requestJson("GET", "/kategori");

  if (kategori.status === 200 && kategori.data.data?.length) {
    kategoriId = kategori.data.data[0].id;
  } else {
    const buatKategori = await requestJson("POST", "/kategori", {
      token,
      body: {
        nama_kategori: `Smoke Upload ${suffix}`,
        deskripsi: "Kategori sementara untuk smoke test.",
      },
    });

    assert(
      buatKategori.status === 201,
      "Kategori sementara berhasil dibuat"
    );
    kategoriId = buatKategori.data.data?.id;
    kategoriDibuat = kategoriId;
  }

  if (!kategoriId) {
    console.error("Tidak ada kategori untuk menguji upload.");
    process.exitCode = 1;
    return;
  }

  const png = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 30, g: 90, b: 200 },
    },
  })
    .png()
    .toBuffer();

  const form = new FormData();

  form.set("kategori_id", String(kategoriId));
  form.set("nama_alat", `Smoke Upload ${suffix}`);
  form.set("merk", "Test");
  form.set("stok", "1");
  form.set("kondisi", "baik");
  form.set("keterangan", "Dibuat oleh smoke test.");
  form.set("foto", new Blob([png], { type: "image/png" }), "foto.png");

  const upload = await fetch(`${BASE}/alat`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const uploadData = await upload.json().catch(() => ({}));

  assert(
    upload.status === 201,
    "Upload gambar PNG valid berhasil",
    `${upload.status} ${uploadData.message || ""}`
  );

  const alatId = uploadData.data?.id;
  const foto = uploadData.data?.foto;

  assert(
    typeof foto === "string" && foto.endsWith(".webp"),
    "Foto disimpan dengan nama acak berekstensi .webp",
    String(foto)
  );

  if (foto) {
    const fileResponse = await fetch(`${SERVER}/uploads/alat/${foto}`);
    const buffer = Buffer.from(await fileResponse.arrayBuffer());

    assert(
      fileResponse.status === 200 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP",
      "File hasil upload dapat diakses dan benar-benar WebP"
    );

    assert(
      !foto.includes("..") && !foto.includes("/"),
      "Nama file upload tidak mengandung path traversal"
    );
  }

  const fakeForm = new FormData();

  fakeForm.set("kategori_id", String(kategoriId));
  fakeForm.set("nama_alat", `Smoke Fake ${suffix}`);
  fakeForm.set("stok", "1");
  fakeForm.set("kondisi", "baik");
  fakeForm.set(
    "foto",
    new Blob([Buffer.from("<script>alert(1)</script>")], {
      type: "image/png",
    }),
    "polyglot.png"
  );

  const fakeUpload = await fetch(`${BASE}/alat`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: fakeForm,
  });

  assert(
    fakeUpload.status === 400,
    "File bukan gambar ditolak",
    String(fakeUpload.status)
  );

  if (alatId) {
    const hapus = await requestJson("DELETE", `/alat/${alatId}`, {
      token,
    });

    assert(hapus.status === 200, "Alat hasil uji berhasil dihapus");

    if (foto) {
      const filePath = path.join(
        __dirname,
        "..",
        "uploads",
        "alat",
        foto
      );

      assert(
        !fs.existsSync(filePath),
        "File foto ikut terhapus saat alat dihapus"
      );
    }
  }

  if (kategoriDibuat) {
    const hapusKategori = await requestJson(
      "DELETE",
      `/kategori/${kategoriDibuat}`,
      { token }
    );

    assert(
      hapusKategori.status === 200,
      "Kategori sementara berhasil dibersihkan"
    );
  }

  const logout = await requestJson("POST", "/auth/logout", { token });
  assert(logout.status === 200, "Logout admin setelah uji upload");
}

main().catch((error) => {
  console.error("Uji upload gagal:", error.message);
  process.exit(1);
});
