# MusikKu — Sistem Peminjaman Alat Musik

Aplikasi peminjaman alat musik dengan tiga role:

- **Admin**: kelola user, alat, kategori, peminjaman, pengembalian, dan log aktivitas.
- **Petugas**: menyetujui/menolak peminjaman, memantau pengembalian, mencetak laporan.
- **Peminjam**: melihat alat, mengajukan peminjaman, dan mengajukan pengembalian.

## Teknologi

- Backend: Node.js, Express, MySQL, JWT, bcrypt, Multer, Sharp, Helmet.
- Frontend: React, Vite, Axios.

## Struktur

```text
backend/
  config/         konfigurasi env & database
  controllers/    logika API
  database/       skema, migrasi, provisioning, seed
  middleware/     autentikasi, upload, rate limit, log
  routes/         endpoint API
  scripts/        utilitas keamanan & smoke test
  uploads/        file foto alat
frontend/
  src/            aplikasi React
```

## Setup Backend

1. Masuk ke folder backend dan install dependency:

   ```powershell
   cd backend
   npm install
   ```

2. Buat file `.env` dari contoh:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Isi `.env` minimal:

   ```env
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=musikku_app
   DB_PASSWORD=<password acak panjang>
   DB_NAME=db_alatmusik
   JWT_SECRET=<secret acak minimal 32 karakter>
   JWT_EXPIRES_IN=2h
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   ```

   Buat secret acak:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

4. Jalankan migrasi struktur sebagai user admin MySQL:

   ```powershell
   $env:DB_ADMIN_USER="root"
   $env:DB_ADMIN_PASSWORD="<password admin mysql>"
   node database/migrateSecurity.js
   ```

   Untuk MySQL lokal tanpa password, gunakan flag eksplisit berikut:

   ```powershell
   $env:DB_ADMIN_USER="root"
   $env:DB_ALLOW_EMPTY_ADMIN_PASSWORD="1"
   node database/migrateSecurity.js
   ```

5. Buat akun aplikasi MySQL dengan hak minimum:

   ```powershell
   $env:DB_ADMIN_USER="root"
   $env:DB_ADMIN_PASSWORD="<password admin mysql>"
   $env:DB_APP_PASSWORD="<password acak untuk musikku_app>"
   node database/provisionAppUser.js
   ```

   Atau gunakan bootstrap satu kali yang membuat akun aplikasi sekaligus menulis `.env`:

   ```powershell
   $env:DB_ADMIN_USER="root"
   $env:DB_ALLOW_EMPTY_ADMIN_PASSWORD="1"
   node scripts/bootstrapSecurity.js
   ```

6. Buat akun admin pertama (password tidak disimpan di source code):

   ```powershell
   $env:ADMIN_EMAIL="admin@example.com"
   $env:ADMIN_USERNAME="admin"
   $env:ADMIN_PASSWORD="<password kuat>"
   $env:ADMIN_NAME="Administrator"
   node database/createAdmin.js
   ```

   Akun petugas dapat dibuat dengan pola yang sama memakai variabel
   `PETUGAS_EMAIL`, `PETUGAS_USERNAME`, `PETUGAS_PASSWORD`, dan
   `PETUGAS_NAME` pada `seedPetugas.js`.

7. Jalankan backend:

   ```powershell
   npm start
   ```

   Cek kesehatan API: <http://localhost:5000/api/health>

## Setup Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Secara default frontend memakai `http://localhost:5000/api`. Ubah
`VITE_API_URL` pada `frontend/.env` bila backend berada di alamat lain.

Build produksi:

```powershell
npm run build
```

## Keamanan

- JWT berlaku 2 jam dan memuat `token_version`.
- Setiap request memeriksa ulang user, role, dan `token_version` ke database.
- Logout menaikkan `token_version`, sehingga token lama langsung tidak berlaku.
- Login dibatasi per IP dan akun terkunci 15 menit setelah 5 kali gagal.
- Password minimal 8 karakter, harus memuat huruf dan angka.
- Akun MySQL aplikasi hanya memiliki `SELECT`, `INSERT`, `UPDATE`, `DELETE`
  (tanpa hak DDL/GRANT).
- Upload foto hanya menerima JPG/PNG/WebP, diverifikasi magic byte,
  di-re-encode menjadi WebP dengan nama acak, dan dibatasi 5 MB.
- `.env`, file kredensial, dan folder upload tidak boleh ikut di-commit.
- Jalankan migrasi/`createTables` dengan akun admin MySQL, bukan akun aplikasi.
- Jika backend berada di belakang reverse proxy, set `TRUST_PROXY=1` agar
  rate limit memakai IP asli dari proxy tepercaya.

### Kredensial hasil rotasi

File `backend/.rotated-credentials.txt` berisi password baru akun admin dan
petugas. **Simpan isinya ke password manager, lalu hapus file tersebut.**
Segera ganti password melalui menu User setelah login pertama.

## Smoke Test

Dengan backend aktif:

```powershell
cd backend
node scripts/securitySmokeTest.js
node scripts/uploadSmokeTest.js
node scripts/stockSmokeTest.js
node scripts/dbSanityCheck.js
```

`securitySmokeTest.js` menguji RBAC, validasi sesi, logout, dan pembersihan
akun uji. `uploadSmokeTest.js` menguji upload gambar valid, penolakan file
palsu, penyimpanan WebP, dan pembersihan file. `stockSmokeTest.js` menguji
alur stok dari persetujuan, pembatalan, penyerahan, sampai pengembalian
dikonfirmasi tepat satu kali.
