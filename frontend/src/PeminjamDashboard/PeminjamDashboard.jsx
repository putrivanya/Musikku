
import { useCallback, useEffect, useMemo, useState } from "react";
import "./PeminjamDashboard.css";

import {
  API_BASE_URL,
  SERVER_BASE_URL,
  getToken,
  notifySessionExpired,
} from "../api.js";

const API_URL = API_BASE_URL.replace(/\/+$/, "");
const SERVER_URL = SERVER_BASE_URL.replace(/\/+$/, "");

const DENDA_PER_HARI = 50000;
const DENDA_RUSAK_RINGAN = 100000;
const DENDA_RUSAK_BERAT = 200000;

// MAKSIMAL PEMINJAMAN 7 HARI
const MAKS_HARI_PINJAM = 7;

const FORM_AWAL = {
  id_alat: "",
  nama_alat: "",
  tanggal_pinjam: "",
  tanggal_kembali: "",
  jenis_jaminan: "KTP",
  jaminan: "",
  no_telepon: "",
  jumlah: 1,
  catatan: "",
};

const FORM_PENGEMBALIAN_AWAL = {
  kondisi_kembali: "baik",
  catatan: "",
};

// =====================================================
// HELPER TANGGAL
// =====================================================

function tanggalLokal(date = new Date()) {
  const tahun = date.getFullYear();
  const bulan = String(date.getMonth() + 1).padStart(2, "0");
  const hari = String(date.getDate()).padStart(2, "0");

  return `${tahun}-${bulan}-${hari}`;
}

function tambahHari(tanggal, jumlahHari) {
  if (!tanggal) return "";

  const date = new Date(`${String(tanggal).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  date.setDate(date.getDate() + jumlahHari);

  return tanggalLokal(date);
}

function formatTanggal(tanggal) {
  if (!tanggal) return "-";

  const date = new Date(
    `${String(tanggal).slice(0, 10)}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) return tanggal;

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(angka) || 0);
}

// =====================================================
// HELPER DATA
// =====================================================

function normalStatus(status) {
  return String(status || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

function ambilArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.alat)) return response.alat;
  if (Array.isArray(response?.peminjaman)) return response.peminjaman;
  if (Array.isArray(response?.rows)) return response.rows;

  return [];
}

function getIdAlat(item) {
  return item?.id_alat ?? item?.alat_id ?? item?.id ?? "";
}

function getNamaAlat(item) {
  return (
    item?.nama_alat ||
    item?.nama ||
    item?.alat?.nama_alat ||
    item?.alat?.nama ||
    "Alat musik"
  );
}

function getIdPeminjaman(item) {
  return item?.peminjaman_id ?? item?.id_peminjaman ?? item?.id ?? "";
}

function getTanggalKembali(item) {
  return (
    item?.tanggal_rencana_kembali ||
    item?.tanggal_kembali ||
    item?.tanggal_pinjam_sampai ||
    ""
  );
}

function getJumlahAlat(item) {
  if (item?.jumlah) return Number(item.jumlah);

  if (Array.isArray(item?.items) && item.items.length > 0) {
    return item.items.reduce(
      (total, alat) => total + Number(alat.jumlah || 0),
      0
    );
  }

  return 1;
}

function getFoto(item) {
  const foto = item?.foto || item?.gambar || item?.image;

  if (!foto) return "";

  if (
    foto.startsWith("http://") ||
    foto.startsWith("https://") ||
    foto.startsWith("data:")
  ) {
    return foto;
  }

  if (foto.startsWith("/")) {
    return `${SERVER_URL}${foto}`;
  }

  return `${SERVER_URL}/uploads/alat/${foto}`;
}

// =====================================================
// HELPER JAMINAN
// =====================================================

function getJaminan(item) {
  const jenis =
    item?.jenis_jaminan ||
    item?.jenisJaminan ||
    "";

  const isi =
    item?.jaminan ||
    item?.nomor_jaminan ||
    item?.keterangan_jaminan ||
    "";

  if (jenis && isi) {
    return `${jenis} - ${isi}`;
  }

  return isi || jenis || "-";
}

// =====================================================
// HELPER DENDA
// =====================================================

function hitungHariTerlambat(tanggalRencana) {
  if (!tanggalRencana) return 0;

  const sekarang = new Date(`${tanggalLokal()}T00:00:00`);

  const batas = new Date(
    `${String(tanggalRencana).slice(0, 10)}T00:00:00`
  );

  if (Number.isNaN(batas.getTime())) return 0;

  const selisih = Math.floor(
    (sekarang.getTime() - batas.getTime()) / 86400000
  );

  return Math.max(0, selisih);
}

function hitungDenda(item, kondisi = "baik") {
  const hariTerlambat = hitungHariTerlambat(
    getTanggalKembali(item)
  );

  const dendaTerlambat =
    hariTerlambat * DENDA_PER_HARI;

  let dendaKerusakan = 0;

  if (kondisi === "rusak_ringan") {
    dendaKerusakan = DENDA_RUSAK_RINGAN;
  }

  if (kondisi === "rusak_berat") {
    dendaKerusakan = DENDA_RUSAK_BERAT;
  }

  return {
    hariTerlambat,
    dendaTerlambat,
    dendaKerusakan,
    total: dendaTerlambat + dendaKerusakan,
  };
}

// =====================================================
// HELPER STATUS
// =====================================================

function statusPeminjaman(item) {
  const statusAsli = normalStatus(item?.status);

  if (statusAsli === "dipinjam") {
    const terlambat = hitungHariTerlambat(
      getTanggalKembali(item)
    );

    return terlambat > 0 ? "terlambat" : "dipinjam";
  }

  return statusAsli || "menunggu";
}

function labelStatus(status) {
  const daftar = {
    menunggu: "Menunggu Persetujuan",
    disetujui: "Disetujui",
    ditolak: "Ditolak",
    dibatalkan: "Dibatalkan",
    dipinjam: "Sedang Dipinjam",
    terlambat: "Terlambat",
    selesai: "Selesai",
    belum_kembali: "Menunggu Konfirmasi",
    dikembalikan: "Sudah Dikembalikan",
  };

  return daftar[normalStatus(status)] || status || "Tidak diketahui";
}

function statusPengembalian(item) {
  return normalStatus(
    item?.status_pengembalian ||
    item?.pengembalian_status ||
    item?.pengembalian?.status ||
    ""
  );
}

function getTokenHeader() {
  const token = getToken();

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

// =====================================================
// NOTIFIKASI
// =====================================================

function AppError({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="musikku-toast">
      <span>{message}</span>

      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup notifikasi"
      >
        ×
      </button>
    </div>
  );
}

// =====================================================
// KOMPONEN UTAMA
// =====================================================

function PeminjamDashboard() {
  const [menuAktif, setMenuAktif] = useState("beranda");

  const [alat, setAlat] = useState([]);
  const [riwayat, setRiwayat] = useState([]);

  const [loadingAlat, setLoadingAlat] = useState(true);
  const [loadingRiwayat, setLoadingRiwayat] = useState(true);

  const [modalPinjam, setModalPinjam] = useState(false);
  const [modalKembali, setModalKembali] = useState(false);
  const [modalLogout, setModalLogout] = useState(false);

  const [alatDipilih, setAlatDipilih] = useState(null);
  const [peminjamanDipilih, setPeminjamanDipilih] = useState(null);

  const [formPinjam, setFormPinjam] = useState(FORM_AWAL);

  const [formKembali, setFormKembali] = useState(
    FORM_PENGEMBALIAN_AWAL
  );

  const [prosesPinjam, setProsesPinjam] = useState(false);
  const [prosesKembali, setProsesKembali] = useState(false);

  const [pencarian, setPencarian] = useState("");
  const [kategoriAktif, setKategoriAktif] = useState("Semua");
  const [pesan, setPesan] = useState("");

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  });

  const hariIni = tanggalLokal();

  // =====================================================
  // BATAS MAKSIMAL TANGGAL KEMBALI: 7 HARI
  // =====================================================

  const tanggalMaksimal = useMemo(() => {
    if (!formPinjam.tanggal_pinjam) return "";

    return tambahHari(
      formPinjam.tanggal_pinjam,
      MAKS_HARI_PINJAM
    );
  }, [formPinjam.tanggal_pinjam]);

  const namaPengguna =
    user?.nama ||
    user?.nama_lengkap ||
    user?.username ||
    user?.name ||
    "Peminjam";

  const tampilkanPesan = useCallback((teks) => {
    setPesan(teks);
  }, []);

  const tutupPesan = useCallback(() => {
    setPesan("");
  }, []);

  // =====================================================
  // REQUEST API
  // =====================================================

  const requestAPI = useCallback(async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,

      headers: {
        ...getTokenHeader(),

        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),

        ...options.headers,
      },
    });

    let result = {};

    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (response.status === 401) {
      notifySessionExpired?.();

      throw new Error(
        "Sesi login berakhir. Silakan login kembali."
      );
    }

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.pesan ||
        "Terjadi kesalahan saat menghubungi server."
      );
    }

    return result;
  }, []);

  // =====================================================
  // AMBIL DATA ALAT
  // =====================================================

  const ambilAlat = useCallback(async () => {
    setLoadingAlat(true);

    try {
      const result = await requestAPI("/alat");

      setAlat(ambilArray(result));
    } catch (error) {
      tampilkanPesan(
        error.message || "Gagal mengambil katalog alat."
      );
    } finally {
      setLoadingAlat(false);
    }
  }, [requestAPI, tampilkanPesan]);

  // =====================================================
  // AMBIL RIWAYAT
  // =====================================================

  const ambilRiwayat = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingRiwayat(true);
    }

    try {
      const result = await requestAPI("/peminjaman/saya");

      setRiwayat(ambilArray(result));
    } catch (error) {
      if (!silent) {
        tampilkanPesan(
          error.message || "Gagal mengambil riwayat peminjaman."
        );
      }
    } finally {
      if (!silent) {
        setLoadingRiwayat(false);
      }
    }
  }, [requestAPI, tampilkanPesan]);

  // =====================================================
  // EFFECT
  // =====================================================

  useEffect(() => {
    ambilAlat();
    ambilRiwayat();
  }, [ambilAlat, ambilRiwayat]);

  useEffect(() => {
    const interval = setInterval(() => {
      ambilRiwayat(true);
    }, 20000);

    return () => clearInterval(interval);
  }, [ambilRiwayat]);

  useEffect(() => {
    const updateUser = () => {
      try {
        setUser(
          JSON.parse(localStorage.getItem("user")) || {}
        );
      } catch {
        setUser({});
      }
    };

    window.addEventListener("storage", updateUser);

    return () => {
      window.removeEventListener("storage", updateUser);
    };
  }, []);

  // =====================================================
  // DATA KATEGORI
  // =====================================================

  const kategori = useMemo(() => {
    const daftar = alat
      .map(
        (item) =>
          item?.nama_kategori ||
          item?.kategori?.nama_kategori
      )
      .filter(Boolean);

    return ["Semua", ...new Set(daftar)];
  }, [alat]);

  // =====================================================
  // FILTER KATALOG
  // =====================================================

  const alatTersaring = useMemo(() => {
    return alat.filter((item) => {
      const nama = getNamaAlat(item).toLowerCase();

      const merk = String(
        item?.merk || ""
      ).toLowerCase();

      const kata = pencarian.toLowerCase();

      const cocokPencarian =
        nama.includes(kata) ||
        merk.includes(kata);

      const namaKategori =
        item?.nama_kategori ||
        item?.kategori?.nama_kategori ||
        "";

      const cocokKategori =
        kategoriAktif === "Semua" ||
        namaKategori === kategoriAktif;

      return cocokPencarian && cocokKategori;
    });
  }, [alat, pencarian, kategoriAktif]);

  // =====================================================
  // STATISTIK
  // =====================================================

  const jumlahMenunggu = riwayat.filter(
    (item) => normalStatus(item?.status) === "menunggu"
  ).length;

  const jumlahDipinjam = riwayat.filter(
    (item) => normalStatus(item?.status) === "dipinjam"
  ).length;

  const jumlahBelumKembali = riwayat.filter((item) => {
    const statusAsli = normalStatus(item?.status);
    const statusKembali = statusPengembalian(item);

    return (
      statusAsli === "dipinjam" &&
      statusKembali !== "belum_kembali" &&
      statusKembali !== "dikembalikan"
    );
  }).length;

  // =====================================================
  // BUKA FORM PEMINJAMAN
  // =====================================================

  const bukaFormPinjam = (item) => {
    const stok = Number(item?.stok ?? 0);

    if (stok <= 0) {
      tampilkanPesan("Stok alat sedang habis.");
      return;
    }

    setAlatDipilih(item);

    setFormPinjam({
      ...FORM_AWAL,

      id_alat: getIdAlat(item),
      nama_alat: getNamaAlat(item),

      tanggal_pinjam: hariIni,
      tanggal_kembali: tambahHari(hariIni, 1),

      jumlah: 1,
    });

    setModalPinjam(true);
  };

  // =====================================================
  // UBAH FORM PEMINJAMAN
  // =====================================================

  const ubahFormPinjam = (event) => {
    const { name, value } = event.target;

    if (name === "tanggal_pinjam") {
      setFormPinjam((sebelumnya) => {
        const maksimal = tambahHari(
          value,
          MAKS_HARI_PINJAM
        );

        let tanggalKembali =
          sebelumnya.tanggal_kembali;

        if (!tanggalKembali || tanggalKembali < value) {
          tanggalKembali = value;
        }

        if (tanggalKembali > maksimal) {
          tanggalKembali = maksimal;
        }

        return {
          ...sebelumnya,
          tanggal_pinjam: value,
          tanggal_kembali: tanggalKembali,
        };
      });

      return;
    }

    setFormPinjam((sebelumnya) => ({
      ...sebelumnya,
      [name]: value,
    }));
  };

  // =====================================================
  // KIRIM PEMINJAMAN
  // =====================================================

  const kirimPeminjaman = async (event) => {
    event.preventDefault();

    if (prosesPinjam) return;

    const jumlah = Number(formPinjam.jumlah);
    const stok = Number(alatDipilih?.stok ?? 0);

    if (!formPinjam.id_alat) {
      tampilkanPesan("Alat yang dipilih tidak valid.");
      return;
    }

    if (
      !formPinjam.tanggal_pinjam ||
      !formPinjam.tanggal_kembali
    ) {
      tampilkanPesan("Tanggal peminjaman wajib diisi.");
      return;
    }

    if (formPinjam.tanggal_pinjam < hariIni) {
      tampilkanPesan(
        "Tanggal pinjam tidak boleh sebelum hari ini."
      );
      return;
    }

    if (
      formPinjam.tanggal_kembali <
      formPinjam.tanggal_pinjam
    ) {
      tampilkanPesan(
        "Tanggal kembali tidak boleh sebelum tanggal pinjam."
      );
      return;
    }

    const maksimalKembali = tambahHari(
      formPinjam.tanggal_pinjam,
      MAKS_HARI_PINJAM
    );

    if (formPinjam.tanggal_kembali > maksimalKembali) {
      tampilkanPesan(
        "Maksimal peminjaman adalah 7 hari."
      );
      return;
    }

    if (
      !Number.isInteger(jumlah) ||
      jumlah < 1 ||
      jumlah > stok
    ) {
      tampilkanPesan(
        `Jumlah alat harus antara 1 sampai ${stok}.`
      );
      return;
    }

    const nomorTelepon =
      String(formPinjam.no_telepon).replace(/\D/g, "");

    if (
      nomorTelepon.length < 10 ||
      nomorTelepon.length > 15
    ) {
      tampilkanPesan(
        "Nomor WhatsApp harus terdiri dari 10 sampai 15 angka."
      );
      return;
    }

    const nomorJaminan = formPinjam.jaminan.trim();

    if (!nomorJaminan) {
      tampilkanPesan(
        "Nomor atau keterangan jaminan wajib diisi."
      );
      return;
    }

    /*
      Database saat ini menyimpan jaminan dalam satu kolom.
      Karena itu jenis dan nomor digabung agar keduanya tersimpan.
      Contoh: KTP - 123456789
    */

    const jaminanLengkap =
      `${formPinjam.jenis_jaminan} - ${nomorJaminan}`;

    const payload = {
      id_alat: Number(formPinjam.id_alat),

      nama_alat: formPinjam.nama_alat,

      tanggal_pinjam: formPinjam.tanggal_pinjam,

      tanggal_kembali: formPinjam.tanggal_kembali,

      tanggal_rencana_kembali:
        formPinjam.tanggal_kembali,

      jenis_jaminan: formPinjam.jenis_jaminan,

      jaminan: jaminanLengkap,

      no_telepon: nomorTelepon,

      jumlah,

      catatan: formPinjam.catatan.trim(),
    };

    setProsesPinjam(true);

    try {
      const result = await requestAPI("/peminjaman", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      tampilkanPesan(
        result?.message ||
        result?.pesan ||
        "Pengajuan peminjaman berhasil dikirim."
      );

      setModalPinjam(false);
      setFormPinjam(FORM_AWAL);
      setAlatDipilih(null);

      await Promise.all([
        ambilAlat(),
        ambilRiwayat(),
      ]);

      setMenuAktif("riwayat");
    } catch (error) {
      tampilkanPesan(
        error.message || "Peminjaman gagal dikirim."
      );
    } finally {
      setProsesPinjam(false);
    }
  };

  // =====================================================
  // BUKA FORM PENGEMBALIAN
  // =====================================================

  const bukaFormKembali = (item) => {
    const statusAsli = normalStatus(item?.status);

    // Terlambat tetap boleh mengajukan pengembalian.
    if (statusAsli !== "dipinjam") {
      tampilkanPesan(
        "Alat hanya dapat dikembalikan jika status peminjaman dipinjam."
      );

      return;
    }

    const statusKembali = statusPengembalian(item);

    if (
      statusKembali === "belum_kembali" ||
      statusKembali === "dikembalikan"
    ) {
      tampilkanPesan(
        "Pengajuan pengembalian untuk transaksi ini sudah ada."
      );

      return;
    }

    setPeminjamanDipilih(item);
    setFormKembali(FORM_PENGEMBALIAN_AWAL);
    setModalKembali(true);
  };

  // =====================================================
  // KIRIM PENGEMBALIAN
  // =====================================================

  const kirimPengembalian = async (event) => {
    event.preventDefault();

    if (!peminjamanDipilih || prosesKembali) return;

    const id = getIdPeminjaman(peminjamanDipilih);

    if (!id) {
      tampilkanPesan("ID peminjaman tidak ditemukan.");
      return;
    }

    const payload = {
      peminjaman_id: Number(id),

      tanggal_kembali: hariIni,

      kondisi_kembali: formKembali.kondisi_kembali,

      catatan: formKembali.catatan.trim(),
    };

    setProsesKembali(true);

    try {
      const result = await requestAPI("/pengembalian", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      tampilkanPesan(
        result?.message ||
        result?.pesan ||
        "Pengajuan pengembalian berhasil dikirim. Menunggu konfirmasi petugas."
      );

      setModalKembali(false);
      setPeminjamanDipilih(null);
      setFormKembali(FORM_PENGEMBALIAN_AWAL);

      await ambilRiwayat();
    } catch (error) {
      tampilkanPesan(
        error.message || "Pengajuan pengembalian gagal."
      );
    } finally {
      setProsesKembali(false);
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const keluarAkun = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    localStorage.removeItem("id_user");

    window.location.href = "/login";
  };

  // =====================================================
  // URUTKAN RIWAYAT
  // =====================================================

  const daftarRiwayat = useMemo(() => {
    return [...riwayat].sort((a, b) => {
      return (
        new Date(
          b?.created_at ||
          b?.tanggal_pinjam ||
          0
        ) -
        new Date(
          a?.created_at ||
          a?.tanggal_pinjam ||
          0
        )
      );
    });
  }, [riwayat]);

  const biayaKembali = peminjamanDipilih
    ? hitungDenda(
        peminjamanDipilih,
        formKembali.kondisi_kembali
      )
    : null;

  // =====================================================
  // TAMPILAN
  // =====================================================

  return (
    <div className="musikku-app">

      {/* NAVBAR */}

      <header className="musikku-navbar">
        <div className="musikku-navbar-inner">

          <button
            type="button"
            className="musikku-brand"
            onClick={() => setMenuAktif("beranda")}
          >
            <span className="musikku-brand-icon">
              ♫
            </span>

            <span>
              <strong>MusikKu</strong>
              <small>Rental Alat Musik</small>
            </span>
          </button>

          <nav className="musikku-nav">

            <button
              type="button"
              className={
                menuAktif === "beranda" ? "active" : ""
              }
              onClick={() => setMenuAktif("beranda")}
            >
              Beranda
            </button>

            <button
              type="button"
              className={
                menuAktif === "katalog" ? "active" : ""
              }
              onClick={() => setMenuAktif("katalog")}
            >
              Katalog
            </button>

            <button
              type="button"
              className={
                menuAktif === "riwayat" ? "active" : ""
              }
              onClick={() => setMenuAktif("riwayat")}
            >
              Riwayat

              {jumlahBelumKembali > 0 && (
                <span className="musikku-nav-badge">
                  {jumlahBelumKembali}
                </span>
              )}
            </button>

          </nav>

          <div className="musikku-account">

            <div className="musikku-avatar">
              {namaPengguna.charAt(0).toUpperCase()}
            </div>

            <div className="musikku-account-name">
              <span>Halo,</span>
              <strong>{namaPengguna}</strong>
            </div>

            <button
              type="button"
              className="musikku-logout-button"
              onClick={() => setModalLogout(true)}
            >
              Keluar
            </button>

          </div>
        </div>
      </header>

      <main className="musikku-main">

        {/* BERANDA */}

        {menuAktif === "beranda" && (
          <>

            <section className="musikku-hero">

              <div className="musikku-hero-content">

                <span className="musikku-eyebrow">
                  SELAMAT DATANG DI MUSIKKU
                </span>

                <h1>
                  Temukan alat musik,
                  <br />
                  mulai perjalanan musikmu.
                </h1>

                <p>
                  Pilih alat musik yang kamu butuhkan dan ajukan
                  peminjaman dengan mudah melalui MusikKu.
                </p>

                <button
                  type="button"
                  className="musikku-primary-button"
                  onClick={() => setMenuAktif("katalog")}
                >
                  Lihat Katalog <span>→</span>
                </button>

              </div>

              <div className="musikku-hero-decoration">
                <span className="musikku-note note-one">
                  ♪
                </span>

                <span className="musikku-note note-two">
                  ♫
                </span>

                <div className="musikku-hero-circle">
                  <span>♫</span>
                </div>
              </div>

            </section>

            <section className="musikku-stat-grid">

              <div className="musikku-stat-card">
                <span className="musikku-stat-icon">
                  ♫
                </span>

                <div>
                  <strong>{alat.length}</strong>
                  <span>Jenis Alat Musik</span>
                </div>
              </div>

              <div className="musikku-stat-card">
                <span className="musikku-stat-icon">
                  ◷
                </span>

                <div>
                  <strong>{jumlahMenunggu}</strong>
                  <span>Menunggu Persetujuan</span>
                </div>
              </div>

              <div className="musikku-stat-card">
                <span className="musikku-stat-icon">
                  ♬
                </span>

                <div>
                  <strong>{jumlahDipinjam}</strong>
                  <span>Sedang Dipinjam</span>
                </div>
              </div>

            </section>

            <section className="musikku-section">

              <div className="musikku-section-heading">

                <div>
                  <span className="musikku-eyebrow">
                    PILIHAN ALAT
                  </span>

                  <h2>Alat musik tersedia</h2>

                  <p>
                    Beberapa alat musik yang dapat kamu pinjam.
                  </p>
                </div>

                <button
                  type="button"
                  className="musikku-text-button"
                  onClick={() => setMenuAktif("katalog")}
                >
                  Lihat semua →
                </button>

              </div>

              {loadingAlat ? (
                <div className="musikku-empty">
                  Sedang memuat katalog...
                </div>
              ) : (
                <div className="musikku-product-grid">

                  {alat.slice(0, 4).map((item) => (
                    <KartuAlat
                      key={getIdAlat(item)}
                      item={item}
                      onPinjam={bukaFormPinjam}
                    />
                  ))}

                  {alat.length === 0 && (
                    <div className="musikku-empty">
                      Belum ada alat musik yang tersedia.
                    </div>
                  )}

                </div>
              )}

            </section>

            <section className="musikku-section">

              <div className="musikku-section-heading">

                <div>
                  <span className="musikku-eyebrow">
                    INFORMASI
                  </span>

                  <h2>Persyaratan peminjaman</h2>

                  <p>
                    Baca ketentuan sebelum mengajukan peminjaman.
                  </p>
                </div>

              </div>

              <div className="musikku-rule-grid">

                <div className="musikku-rule-card">
                  <span className="musikku-rule-number">
                    01
                  </span>

                  <h3>Wajib menggunakan jaminan</h3>

                  <p>
                    Peminjam wajib memberikan jaminan berupa KTP,
                    SIM, atau STNK yang masih berlaku.
                  </p>
                </div>

                <div className="musikku-rule-card">
                  <span className="musikku-rule-number">
                    02
                  </span>

                  <h3>Batas waktu peminjaman</h3>

                  <p>
                    Maksimal waktu peminjaman adalah 7 hari.
                    Alat harus dikembalikan sesuai tanggal yang dipilih.
                  </p>
                </div>

                <div className="musikku-rule-card">
                  <span className="musikku-rule-number">
                    03
                  </span>

                  <h3>Denda keterlambatan</h3>

                  <p>
                    Denda sebesar Rp50.000 untuk setiap hari
                    keterlambatan pengembalian.
                  </p>
                </div>

              </div>

              <div className="musikku-fine-panel">

                <div>
                  <span className="musikku-eyebrow">
                    KETENTUAN DENDA
                  </span>

                  <h3>Jaga alat musik dengan baik.</h3>

                  <p>
                    Biaya kerusakan ditentukan berdasarkan kondisi
                    alat ketika diperiksa petugas.
                  </p>
                </div>

                <div className="musikku-fine-list">

                  <div>
                    <span>Rusak ringan</span>
                    <strong>
                      {formatRupiah(DENDA_RUSAK_RINGAN)}
                    </strong>
                  </div>

                  <div>
                    <span>Rusak berat</span>
                    <strong>
                      {formatRupiah(DENDA_RUSAK_BERAT)}
                    </strong>
                  </div>

                  <div>
                    <span>Terlambat per hari</span>
                    <strong>
                      {formatRupiah(DENDA_PER_HARI)}
                    </strong>
                  </div>

                </div>
              </div>

            </section>

          </>
        )}

        {/* KATALOG */}

        {menuAktif === "katalog" && (
          <section className="musikku-section musikku-page-section">

            <div className="musikku-section-heading">

              <div>
                <span className="musikku-eyebrow">
                  KOLEKSI MUSIKKU
                </span>

                <h1>Katalog Alat Musik</h1>

                <p>
                  Pilih alat musik yang ingin kamu pinjam.
                </p>
              </div>

            </div>

            <div className="musikku-filter">

              <div className="musikku-search">
                <span>⌕</span>

                <input
                  type="search"
                  placeholder="Cari nama atau merek alat musik..."
                  value={pencarian}
                  onChange={(event) =>
                    setPencarian(event.target.value)
                  }
                />
              </div>

              <div className="musikku-category-list">

                {kategori.map((nama) => (
                  <button
                    type="button"
                    key={nama}
                    className={
                      kategoriAktif === nama ? "active" : ""
                    }
                    onClick={() => setKategoriAktif(nama)}
                  >
                    {nama}
                  </button>
                ))}

              </div>

            </div>

            {loadingAlat ? (
              <div className="musikku-empty">
                Memuat katalog alat musik...
              </div>
            ) : (
              <div className="musikku-product-grid">

                {alatTersaring.map((item) => (
                  <KartuAlat
                    key={getIdAlat(item)}
                    item={item}
                    onPinjam={bukaFormPinjam}
                  />
                ))}

                {alatTersaring.length === 0 && (
                  <div className="musikku-empty">
                    Alat musik yang kamu cari tidak ditemukan.
                  </div>
                )}

              </div>
            )}

          </section>
        )}

        {/* RIWAYAT */}

        {menuAktif === "riwayat" && (
          <section className="musikku-section musikku-page-section">

            <div className="musikku-section-heading">

              <div>
                <span className="musikku-eyebrow">
                  AKTIVITAS AKUN
                </span>

                <h1>Riwayat Peminjaman</h1>

                <p>
                  Pantau status peminjaman dan pengembalian alat musikmu.
                </p>
              </div>

              <button
                type="button"
                className="musikku-refresh-button"
                onClick={() => ambilRiwayat()}
              >
                ↻ Perbarui
              </button>

            </div>

            {loadingRiwayat ? (
              <div className="musikku-empty">
                Memuat riwayat peminjaman...
              </div>
            ) : daftarRiwayat.length === 0 ? (

              <div className="musikku-empty musikku-empty-large">

                <span>♫</span>

                <h3>Belum ada riwayat peminjaman</h3>

                <p>
                  Peminjaman alat musik yang kamu ajukan
                  akan muncul di sini.
                </p>

                <button
                  type="button"
                  className="musikku-primary-button"
                  onClick={() => setMenuAktif("katalog")}
                >
                  Lihat Katalog
                </button>

              </div>

            ) : (

              <div className="musikku-history-list">

                {daftarRiwayat.map((item, index) => {

                  const status = statusPeminjaman(item);
                  const statusAsli = normalStatus(item?.status);
                  const statusKembali = statusPengembalian(item);

                  const id = getIdPeminjaman(item);
                  const tanggalAkhir = getTanggalKembali(item);
                  const biaya = hitungDenda(item);

                  const bisaKembali =
                    statusAsli === "dipinjam" &&
                    statusKembali !== "belum_kembali" &&
                    statusKembali !== "dikembalikan";

                  return (

                    <article
                      className="musikku-history-card"
                      key={id || index}
                    >

                      <div className="musikku-history-top">

                        <div>
                          <span className="musikku-history-id">
                            KODE PEMINJAMAN #{id || "-"}
                          </span>

                          <h3>{getNamaAlat(item)}</h3>
                        </div>

                        <span
                          className={`musikku-status status-${status}`}
                        >
                          {labelStatus(status)}
                        </span>

                      </div>

                      <div className="musikku-history-details">

                        <div>
                          <span>Tanggal pinjam</span>

                          <strong>
                            {formatTanggal(item?.tanggal_pinjam)}
                          </strong>
                        </div>

                        <div>
                          <span>Rencana kembali</span>

                          <strong>
                            {formatTanggal(tanggalAkhir)}
                          </strong>
                        </div>

                        <div>
                          <span>Jumlah</span>

                          <strong>
                            {getJumlahAlat(item)} unit
                          </strong>
                        </div>

                        <div>
                          <span>Jaminan</span>

                          <strong>
                            {getJaminan(item)}
                          </strong>
                        </div>

                      </div>

                      {status === "disetujui" && (
                        <div className="musikku-info-alert">
                          Pengajuan disetujui. Silakan datang ke studio
                          untuk mengambil alat musik dengan membawa
                          jaminan yang telah didaftarkan. Tombol
                          pengembalian tersedia setelah alat diserahkan
                          oleh petugas.
                        </div>
                      )}

                      {statusKembali === "belum_kembali" && (
                        <div className="musikku-info-alert">
                          Pengajuan pengembalian sudah dikirim.
                          Silakan tunggu pemeriksaan dan konfirmasi petugas.
                        </div>
                      )}

                      {status === "terlambat" && (
                        <div className="musikku-warning-alert">

                          Alat terlambat dikembalikan selama{" "}

                          <strong>
                            {biaya.hariTerlambat} hari
                          </strong>.

                          {" "}Perkiraan denda keterlambatan:{" "}

                          <strong>
                            {formatRupiah(biaya.dendaTerlambat)}
                          </strong>.

                          <p>
                            Kamu tetap dapat mengajukan pengembalian alat.
                            Denda akhir akan diperiksa oleh petugas.
                          </p>

                        </div>
                      )}

                      {(status === "dipinjam" ||
                        status === "terlambat") && (

                        <div className="musikku-return-info">

                          <div>
                            <strong>
                              {status === "terlambat"
                                ? "Alat masih dalam status pinjaman"
                                : "Alat sedang kamu pinjam"}
                            </strong>

                            <span>
                              {status === "terlambat"
                                ? "Segera kembalikan alat untuk menghentikan keterlambatan."
                                : "Pastikan alat dikembalikan sesuai jadwal."}
                            </span>
                          </div>

                          {bisaKembali && (
                            <button
                              type="button"
                              className="musikku-primary-button"
                              onClick={() => bukaFormKembali(item)}
                            >
                              Ajukan Pengembalian
                            </button>
                          )}

                        </div>
                      )}

                      {status === "ditolak" && (
                        <div className="musikku-danger-alert">

                          Pengajuan peminjaman ini ditolak oleh petugas.

                          {item?.catatan && (
                            <span>
                              {" "}Catatan: {item.catatan}
                            </span>
                          )}

                        </div>
                      )}

                      {status === "dibatalkan" && (
                        <div className="musikku-danger-alert">
                          Peminjaman ini telah dibatalkan.
                        </div>
                      )}

                      {status === "selesai" && (
                        <div className="musikku-success-alert">
                          Peminjaman telah selesai. Terima kasih telah
                          mengembalikan alat musik.
                        </div>
                      )}

                    </article>

                  );
                })}

              </div>
            )}

          </section>
        )}

      </main>

      {/* FOOTER */}

      <footer className="musikku-footer">
        <strong>MusikKu</strong>

        <span>
          Tempat alat musik menemukan pemainnya.
        </span>

        <small>
          © {new Date().getFullYear()} MusikKu.
        </small>
      </footer>

      {/* MODAL PEMINJAMAN */}

      {modalPinjam && alatDipilih && (

        <div
          className="musikku-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !prosesPinjam
            ) {
              setModalPinjam(false);
            }
          }}
        >

          <div className="musikku-modal">

            <div className="musikku-modal-header">

              <div>
                <span className="musikku-eyebrow">
                  FORMULIR
                </span>

                <h2>Ajukan Peminjaman</h2>

                <p>
                  Lengkapi data peminjaman alat musik.
                </p>
              </div>

              <button
                type="button"
                className="musikku-modal-close"
                onClick={() => setModalPinjam(false)}
                disabled={prosesPinjam}
              >
                ×
              </button>

            </div>

            <form onSubmit={kirimPeminjaman}>

              <div className="musikku-selected-product">

                {getFoto(alatDipilih) ? (

                  <img
                    src={getFoto(alatDipilih)}
                    alt={getNamaAlat(alatDipilih)}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />

                ) : (

                  <div className="musikku-selected-placeholder">
                    ♫
                  </div>

                )}

                <div>
                  <strong>{getNamaAlat(alatDipilih)}</strong>

                  <span>
                    Stok tersedia: {Number(alatDipilih?.stok || 0)}
                  </span>
                </div>

              </div>

              <div className="musikku-form-grid">

                <div className="musikku-form-group">

                  <label>Tanggal Pinjam</label>

                  <input
                    type="date"
                    name="tanggal_pinjam"
                    value={formPinjam.tanggal_pinjam}
                    min={hariIni}
                    onChange={ubahFormPinjam}
                    required
                  />

                </div>

                <div className="musikku-form-group">

                  <label>Tanggal Kembali</label>

                  <input
                    type="date"
                    name="tanggal_kembali"
                    value={formPinjam.tanggal_kembali}
                    min={formPinjam.tanggal_pinjam || hariIni}
                    max={tanggalMaksimal || undefined}
                    onChange={ubahFormPinjam}
                    required
                  />

                  

                </div>

                <div className="musikku-form-group">

                  <label>Jumlah Alat</label>

                  <input
                    type="number"
                    name="jumlah"
                    min="1"
                    max={Number(alatDipilih?.stok || 1)}
                    value={formPinjam.jumlah}
                    onChange={ubahFormPinjam}
                    required
                  />

                </div>

                <div className="musikku-form-group">

                  <label>Jenis Jaminan</label>

                  <select
                    name="jenis_jaminan"
                    value={formPinjam.jenis_jaminan}
                    onChange={ubahFormPinjam}
                    required
                  >
                    <option value="KTP">KTP</option>
                    <option value="SIM">SIM</option>
                    <option value="STNK">STNK</option>
                  </select>

                </div>

                <div className="musikku-form-group musikku-form-full">

                  <label>
                    Nomor / Keterangan Jaminan
                  </label>

                  <input
                    type="text"
                    name="jaminan"
                    value={formPinjam.jaminan}
                    onChange={ubahFormPinjam}
                    placeholder="Masukkan nomor atau keterangan jaminan"
                    maxLength="200"
                    required
                  />

                </div>

                <div className="musikku-form-group musikku-form-full">

                  <label>Nomor WhatsApp</label>

                  <input
                    type="tel"
                    name="no_telepon"
                    value={formPinjam.no_telepon}
                    onChange={ubahFormPinjam}
                    placeholder="Contoh: 081234567890"
                    minLength="10"
                    maxLength="15"
                    required
                  />

                </div>

                <div className="musikku-form-group musikku-form-full">

                  <label>Catatan (Opsional)</label>

                  <textarea
                    name="catatan"
                    rows="3"
                    value={formPinjam.catatan}
                    onChange={ubahFormPinjam}
                    placeholder="Tambahkan catatan jika diperlukan..."
                    maxLength="1000"
                  />

                </div>

              </div>

              <div className="musikku-form-note">

                <strong>Perhatian</strong>

                <p>
                  Maksimal peminjaman adalah 7 hari.
                  Keterlambatan dikenakan denda Rp50.000
                  per hari. Pengajuan akan diperiksa terlebih
                  dahulu oleh petugas.
                </p>

              </div>

              <div className="musikku-modal-actions">

                <button
                  type="button"
                  className="musikku-secondary-button"
                  onClick={() => setModalPinjam(false)}
                  disabled={prosesPinjam}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="musikku-primary-button"
                  disabled={prosesPinjam}
                >
                  {prosesPinjam
                    ? "Mengirim..."
                    : "Kirim Pengajuan"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* MODAL PENGEMBALIAN */}

      {modalKembali && peminjamanDipilih && (

        <div
          className="musikku-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !prosesKembali
            ) {
              setModalKembali(false);
            }
          }}
        >

          <div className="musikku-modal">

            <div className="musikku-modal-header">

              <div>
                <span className="musikku-eyebrow">
                  FORMULIR
                </span>

                <h2>Pengajuan Pengembalian</h2>

                <p>
                  Periksa kondisi alat sebelum dikembalikan.
                </p>
              </div>

              <button
                type="button"
                className="musikku-modal-close"
                onClick={() => setModalKembali(false)}
                disabled={prosesKembali}
              >
                ×
              </button>

            </div>

            <form onSubmit={kirimPengembalian}>

              <div className="musikku-return-product">

                <span>♫</span>

                <div>
                  <strong>
                    {getNamaAlat(peminjamanDipilih)}
                  </strong>

                  <small>
                    Batas pengembalian:{" "}
                    {formatTanggal(
                      getTanggalKembali(peminjamanDipilih)
                    )}
                  </small>
                </div>

              </div>

              <div className="musikku-form-group">

                <label>
                  Kondisi Alat Saat Dikembalikan
                </label>

                <select
                  value={formKembali.kondisi_kembali}
                  onChange={(event) =>
                    setFormKembali((sebelumnya) => ({
                      ...sebelumnya,
                      kondisi_kembali: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="baik">Baik</option>
                  <option value="rusak_ringan">Rusak Ringan</option>
                  <option value="rusak_berat">Rusak Berat</option>
                </select>

              </div>

              <div className="musikku-form-group">

                <label>Catatan Pengembalian</label>

                <textarea
                  rows="3"
                  value={formKembali.catatan}
                  onChange={(event) =>
                    setFormKembali((sebelumnya) => ({
                      ...sebelumnya,
                      catatan: event.target.value,
                    }))
                  }
                  placeholder="Jelaskan kondisi alat jika ada hal khusus..."
                  maxLength="1000"
                />

              </div>

              {biayaKembali && (

                <div className="musikku-cost-preview">

                  <h3>Perkiraan Denda</h3>

                  <div>
                    <span>
                      Keterlambatan (
                      {biayaKembali.hariTerlambat} hari)
                    </span>

                    <strong>
                      {formatRupiah(
                        biayaKembali.dendaTerlambat
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Kerusakan</span>

                    <strong>
                      {formatRupiah(
                        biayaKembali.dendaKerusakan
                      )}
                    </strong>
                  </div>

                  <div className="musikku-cost-total">

                    <span>Total perkiraan</span>

                    <strong>
                      {formatRupiah(biayaKembali.total)}
                    </strong>

                  </div>

                  <small>
                    Perhitungan ini merupakan perkiraan.
                    Denda akhir ditentukan dan dikonfirmasi
                    oleh petugas setelah pemeriksaan alat.
                  </small>

                </div>

              )}

              <div className="musikku-form-note">

                <strong>Informasi</strong>

                <p>
                  Setelah pengajuan dikirim, status pengembalian
                  akan menunggu pemeriksaan petugas. Pengembalian
                  belum dianggap selesai sebelum dikonfirmasi petugas.
                </p>

              </div>

              <div className="musikku-modal-actions">

                <button
                  type="button"
                  className="musikku-secondary-button"
                  onClick={() => setModalKembali(false)}
                  disabled={prosesKembali}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="musikku-primary-button"
                  disabled={prosesKembali}
                >
                  {prosesKembali
                    ? "Mengirim..."
                    : "Kirim Pengembalian"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* MODAL LOGOUT */}

      {modalLogout && (

        <div className="musikku-modal-overlay">

          <div className="musikku-confirm-modal">

            <div className="musikku-confirm-icon">
              ↗
            </div>

            <h2>Keluar dari akun?</h2>

            <p>
              Kamu harus login kembali untuk mengakses
              halaman peminjam.
            </p>

            <div className="musikku-modal-actions">

              <button
                type="button"
                className="musikku-secondary-button"
                onClick={() => setModalLogout(false)}
              >
                Batal
              </button>

              <button
                type="button"
                className="musikku-primary-button"
                onClick={keluarAkun}
              >
                Ya, Keluar
              </button>

            </div>

          </div>

        </div>
      )}

      <AppError
        message={pesan}
        onClose={tutupPesan}
      />

    </div>
  );
}

// =====================================================
// KARTU ALAT
// =====================================================

function KartuAlat({ item, onPinjam }) {
  const foto = getFoto(item);
  const stok = Number(item?.stok || 0);

  return (

    <article className="musikku-product-card">

      <div className="musikku-product-image">

        {foto ? (

          <img
            src={foto}
            alt={getNamaAlat(item)}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";

              event.currentTarget.parentElement.classList.add(
                "image-error"
              );
            }}
          />

        ) : (

          <div className="musikku-image-placeholder">
            ♫
          </div>

        )}

        {stok > 0 ? (

          <span className="musikku-stock-badge">
            Tersedia
          </span>

        ) : (

          <span className="musikku-stock-badge unavailable">
            Stok Habis
          </span>

        )}

      </div>

      <div className="musikku-product-content">

        <span className="musikku-product-category">
          {item?.nama_kategori ||
            item?.kategori?.nama_kategori ||
            "Alat Musik"}
        </span>

        <h3>{getNamaAlat(item)}</h3>

        <p className="musikku-product-brand">
          {item?.merk || "Tanpa merek"}
        </p>

        <div className="musikku-product-bottom">

          <span>
            Stok <strong>{stok}</strong>
          </span>

          <button
            type="button"
            className="musikku-product-button"
            disabled={stok <= 0}
            onClick={() => onPinjam(item)}
          >
            Pinjam
          </button>

        </div>

      </div>

    </article>

  );
}

export default PeminjamDashboard;
