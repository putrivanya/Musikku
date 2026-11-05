/**
 * Smoke test RBAC & sesi. Jalankan saat backend aktif:
 *   node scripts/securitySmokeTest.js
 *
 * Script membuat satu akun peminjam sementara lalu menghapusnya kembali.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BASE = process.env.API_URL || "http://localhost:5000/api";

function bacaKredensial() {
  const file = path.join(__dirname, "..", ".rotated-credentials.txt");
  const isi = fs.readFileSync(file, "utf8");
  const hasil = {};

  for (const blok of isi.split(/\n(?=[A-Z]+\n)/)) {
    const role = blok.match(/^([A-Z]+)\n/)?.[1];
    const email = blok.match(/Email\s*:\s*(.+)/)?.[1]?.trim();
    const password = blok.match(/Password\s*:\s*(.+)/)?.[1]?.trim();

    if (role && email && password) {
      hasil[role.toLowerCase()] = { email, password };
    }
  }

  return hasil;
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

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : { message: await response.text() };

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
  const kredensial = bacaKredensial();
  const admin = kredensial.admin;
  const petugas = kredensial.petugas;

  assert(Boolean(admin), "Kredensial admin tersedia");
  assert(Boolean(petugas), "Kredensial petugas tersedia");

  if (!admin) return;

  const loginAdmin = await request("POST", "/auth/login", {
    body: { email: admin.email, password: admin.password },
  });

  assert(
    loginAdmin.status === 200 && Boolean(loginAdmin.data.token),
    "Admin dapat login",
    `${loginAdmin.status} ${loginAdmin.data.message || ""}`
  );

  const adminToken = loginAdmin.data.token;

  const meAdmin = await request("GET", "/auth/me", {
    token: adminToken,
  });

  assert(
    meAdmin.status === 200 && meAdmin.data.user?.role === "admin",
    "Token admin valid dan role berasal dari database"
  );

  const semuaPeminjaman = await request("GET", "/peminjaman", {
    token: adminToken,
  });

  assert(
    semuaPeminjaman.status === 200 &&
      Array.isArray(semuaPeminjaman.data.data),
    "Admin dapat membaca seluruh peminjaman"
  );

  const logAdmin = await request("GET", "/log-aktivitas", {
    token: adminToken,
  });

  assert(logAdmin.status === 200, "Admin dapat membaca log aktivitas");

  const loginPetugas = await request("POST", "/auth/login", {
    body: { email: petugas.email, password: petugas.password },
  });

  assert(
    loginPetugas.status === 200,
    "Petugas dapat login",
    `${loginPetugas.status} ${loginPetugas.data.message || ""}`
  );

  const petugasToken = loginPetugas.data.token;
  const petugasUsers = await request("GET", "/users", {
    token: petugasToken,
  });

  assert(
    petugasUsers.status === 403,
    "Petugas tidak dapat mengakses manajemen user"
  );

  const suffix = crypto.randomBytes(4).toString("hex");
  const testEmail = `security.test.${suffix}@musikku.local`;
  const testUsername = `sectest${suffix}`;
  const testPassword = `Test${suffix}Aa1!`;

  const buatUser = await request("POST", "/users", {
    token: adminToken,
    body: {
      nama: "Security Smoke Test",
      username: testUsername,
      email: testEmail,
      password: testPassword,
      role_id: 3,
    },
  });

  assert(
    buatUser.status === 201,
    "Admin dapat membuat akun uji",
    `${buatUser.status} ${buatUser.data.message || ""}`
  );

  const testUserId = buatUser.data.data?.id;

  if (testUserId) {
    const loginTest = await request("POST", "/auth/login", {
      body: { email: testEmail, password: testPassword },
    });

    assert(loginTest.status === 200, "Akun peminjam uji dapat login");

    const testToken = loginTest.data.token;

    const allLoans = await request("GET", "/peminjaman", {
      token: testToken,
    });

    assert(
      allLoans.status === 403,
      "Peminjam ditolak saat membaca seluruh peminjaman"
    );

    const approve = await request(
      "PATCH",
      "/peminjaman/999999/status",
      {
        token: testToken,
        body: { status: "disetujui" },
      }
    );

    assert(
      approve.status === 403,
      "Peminjam ditolak saat mencoba menyetujui peminjaman"
    );

    const hapusOrangLain = await request(
      "DELETE",
      "/peminjaman/1",
      { token: testToken }
    );

    assert(
      [403, 404].includes(hapusOrangLain.status) &&
        hapusOrangLain.status !== 200,
      "Peminjam tidak dapat menghapus peminjaman milik orang lain",
      String(hapusOrangLain.status)
    );

    const userList = await request("GET", "/users", {
      token: testToken,
    });

    assert(
      userList.status === 403,
      "Peminjam ditolak saat mengakses manajemen user"
    );

    const logoutTest = await request("POST", "/auth/logout", {
      token: testToken,
    });

    assert(logoutTest.status === 200, "Logout peminjam berhasil");

    const meSetelahLogout = await request("GET", "/auth/me", {
      token: testToken,
    });

    assert(
      meSetelahLogout.status === 401,
      "Token lama tidak berlaku setelah logout"
    );

    const hapusTest = await request("DELETE", `/users/${testUserId}`, {
      token: adminToken,
    });

    assert(
      hapusTest.status === 200,
      "Akun uji berhasil dibersihkan",
      `${hapusTest.status} ${hapusTest.data.message || ""}`
    );
  }

  const logoutAdmin = await request("POST", "/auth/logout", {
    token: adminToken,
  });

  assert(logoutAdmin.status === 200, "Logout admin berhasil");

  const meAdminSetelahLogout = await request("GET", "/auth/me", {
    token: adminToken,
  });

  assert(
    meAdminSetelahLogout.status === 401,
    "Token admin lama tidak berlaku setelah logout"
  );

  const logoutPetugas = await request("POST", "/auth/logout", {
    token: petugasToken,
  });

  assert(logoutPetugas.status === 200, "Logout petugas berhasil");
}

main().catch((error) => {
  console.error("Smoke test gagal:", error.message);
  process.exit(1);
});
