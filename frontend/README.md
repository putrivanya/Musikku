# Frontend MusikKu

Aplikasi React + Vite untuk Sistem Peminjaman Alat Musik MusikKu.

## Menjalankan

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Secara default frontend memanggil `http://localhost:5000/api`. Ubah
`VITE_API_URL` di `frontend/.env` jika backend berjalan di alamat lain.

## Build

```powershell
npm run build
```

## Catatan

- Token JWT disimpan di `localStorage` dan divalidasi ulang melalui
  `/auth/me` setiap aplikasi dibuka.
- Jangan menaruh secret backend di file `.env` frontend; semua variabel
  `VITE_*` akan ikut ter-bundle ke browser.
- Dokumentasi setup lengkap ada di `../README.md`.
