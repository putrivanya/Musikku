
import { useCallback, useEffect, useState } from "react";
import "./AdminDashboard.css";
import { api, logoutSession } from "../api.js";

import User from "./User.jsx";
import AlatMusik from "./AlatMusik.jsx";
import Kategori from "./Kategori.jsx";
import Peminjaman from "./Peminjaman.jsx";
import Pengembalian from "./Pengembalian.jsx";
import LogAktivitas from "./LogAktivitas.jsx";

const menus = [
  { id: "dashboard", icon: "▦", label: "Dashboard" },
  { id: "pengguna", icon: "♙", label: "User" },
  { id: "alat", icon: "♫", label: "Alat Musik" },
  { id: "kategori", icon: "▤", label: "Kategori" },
  { id: "peminjaman", icon: "⇄", label: "Peminjaman" },
  { id: "pengembalian", icon: "↩", label: "Pengembalian" },
  { id: "aktivitas", icon: "◷", label: "Log Aktivitas" },
];

const descriptions = {
  pengguna: "Kelola akun admin, petugas, dan peminjam.",
  alat: "Kelola inventaris dan informasi alat musik.",
  kategori: "Kelola kategori alat musik.",
  peminjaman: "Kelola transaksi peminjaman alat musik.",
  pengembalian: "Kelola data pengembalian alat musik.",
  aktivitas: "Pantau aktivitas dalam sistem MusikKu.",
};

const EMPTY_STATS = {
  alat: null,
  aktif: null,
  menunggu: null,
  pengguna: null,
};

const STATUS_MENUNGGU = [
  "menunggu",
  "pending",
  "menunggu_persetujuan",
  "diajukan",
  "diajukan_peminjaman",
];

const STATUS_AKTIF = [
  "disetujui",
  "dipinjam",
  "dipinjamkan",
  "sedang_dipinjam",
  "belum_kembali",
];

function normalisasiStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function ambilArray(response) {
  const data = response?.data ?? response;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

function ambilStatus(item) {
  return normalisasiStatus(
    item?.status ??
    item?.status_peminjaman ??
    item?.status_pinjam ??
    item?.status_transaksi ??
    item?.status_pengembalian
  );
}

function formatTanggal(value) {
  if (!value) return "-";

  const tanggal = new Date(value);

  if (Number.isNaN(tanggal.getTime())) {
    return String(value);
  }

  return tanggal.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ambilNamaPeminjam(item) {
  return (
    item?.nama_peminjam ||
    item?.nama_user ||
    item?.nama ||
    item?.nama_pengguna ||
    item?.customer_name ||
    item?.user?.nama ||
    item?.pengguna?.nama ||
    item?.peminjam?.nama ||
    "-"
  );
}

function ambilNamaAlat(item) {
  return (
    item?.nama_alat ||
    item?.nama_barang ||
    item?.nama_inventaris ||
    item?.alat?.nama_alat ||
    item?.alatMusik?.nama_alat ||
    item?.nama ||
    "-"
  );
}

function ambilId(item) {
  return (
    item?.id_peminjaman ??
    item?.id_pinjam ??
    item?.id ??
    item?.peminjaman_id ??
    "-"
  );
}

function labelStatus(status) {
  const labels = {
    pending: "Menunggu",
    menunggu: "Menunggu",
    menunggu_persetujuan: "Menunggu Persetujuan",
    diajukan: "Diajukan",
    disetujui: "Disetujui",
    dipinjam: "Dipinjam",
    dipinjamkan: "Dipinjamkan",
    sedang_dipinjam: "Sedang Dipinjam",
    belum_kembali: "Belum Kembali",
    selesai: "Selesai",
    dikembalikan: "Dikembalikan",
    ditolak: "Ditolak",
    rejected: "Ditolak",
    dibatalkan: "Dibatalkan",
  };

  return labels[status] || status.replace(/_/g, " ") || "-";
}

async function ambilDataDariAPI(endpoints) {
  let errorTerakhir = null;

  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint);
      const data = ambilArray(response);

      return {
        data,
        endpoint,
        error: null,
      };
    } catch (error) {
      errorTerakhir = error;
    }
  }

  return {
    data: [],
    endpoint: null,
    error: errorTerakhir,
  };
}

export default function AdminDashboard({ onLogout }) {
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [toast, setToast] = useState(null);

  const [user] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("user") ||
        localStorage.getItem("currentUser") ||
        "{}"
      );
    } catch {
      return {};
    }
  });

  const [stats, setStats] = useState(EMPTY_STATS);
  const [peminjamanTerbaru, setPeminjamanTerbaru] = useState([]);
  const [menungguPengembalian, setMenungguPengembalian] = useState(0);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [errorDashboard, setErrorDashboard] = useState("");
  const [waktuPembaruan, setWaktuPembaruan] = useState(null);

  const namaAdmin =
    user.nama ||
    user.name ||
    user.username ||
    user.email ||
    "Administrator";

  const activeLabel =
    menus.find((menu) => menu.id === activeMenu)?.label ||
    "Dashboard";

  // CUSTOM NOTIFICATION
  const tampilkanNotifikasi = useCallback(
    (jenis, judul, pesan) => {
      setToast({
        id: Date.now(),
        jenis,
        judul,
        pesan,
      });
    },
    []
  );

  // Hilangkan notifikasi secara otomatis
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast]);

  // LOAD DASHBOARD
  const muatDashboard = useCallback(async (manual = false) => {
    try {
      setErrorDashboard("");

      const [
        hasilAlat,
        hasilPeminjaman,
        hasilPengguna,
        hasilPengembalian,
      ] = await Promise.all([
        ambilDataDariAPI([
          "/alat",
          "/alat-musik",
          "/alatmusik",
        ]),
        ambilDataDariAPI([
          "/peminjaman",
        ]),
        ambilDataDariAPI([
          "/users",
          "/user",
          "/pengguna",
        ]),
        ambilDataDariAPI([
          "/pengembalian",
        ]),
      ]);

      const alatBerhasil = Boolean(hasilAlat.endpoint);
      const pinjamBerhasil = Boolean(hasilPeminjaman.endpoint);
      const penggunaBerhasil = Boolean(hasilPengguna.endpoint);
      const kembaliBerhasil = Boolean(hasilPengembalian.endpoint);

      setStats({
        alat: alatBerhasil ? hasilAlat.data.length : null,

        aktif: pinjamBerhasil
          ? hasilPeminjaman.data.filter((item) =>
              STATUS_AKTIF.includes(ambilStatus(item))
            ).length
          : null,

        menunggu: pinjamBerhasil
          ? hasilPeminjaman.data.filter((item) =>
              STATUS_MENUNGGU.includes(ambilStatus(item))
            ).length
          : null,

        pengguna: penggunaBerhasil
          ? hasilPengguna.data.length
          : null,
      });

      if (pinjamBerhasil) {
        const dataTerbaru = [...hasilPeminjaman.data]
          .sort((a, b) => {
            const tanggalA = new Date(
              a.created_at ||
              a.tanggal_pengajuan ||
              a.tanggal_pinjam ||
              0
            ).getTime();

            const tanggalB = new Date(
              b.created_at ||
              b.tanggal_pengajuan ||
              b.tanggal_pinjam ||
              0
            ).getTime();

            return tanggalB - tanggalA;
          })
          .slice(0, 5);

        setPeminjamanTerbaru(dataTerbaru);
      } else {
        setPeminjamanTerbaru([]);
      }

      if (kembaliBerhasil) {
        const jumlahBelumKembali =
          hasilPengembalian.data.filter((item) => {
            return [
              "belum_kembali",
              "menunggu_verifikasi",
              "menunggu_pemeriksaan",
              "diajukan",
              "pending",
              "menunggu",
            ].includes(ambilStatus(item));
          }).length;

        setMenungguPengembalian(jumlahBelumKembali);
      }

      const endpointGagal = [
        !alatBerhasil && "alat musik",
        !pinjamBerhasil && "peminjaman",
        !penggunaBerhasil && "pengguna",
        !kembaliBerhasil && "pengembalian",
      ].filter(Boolean);

      if (endpointGagal.length > 0) {
        const pesan = `Data ${endpointGagal.join(", ")} belum berhasil dimuat.`;

        setErrorDashboard(pesan);

        if (manual) {
          tampilkanNotifikasi(
            "warning",
            "Data belum lengkap",
            pesan
          );
        }
      } else if (manual) {
        tampilkanNotifikasi(
          "success",
          "Data berhasil diperbarui",
          "Seluruh informasi dashboard berhasil dimuat."
        );
      }

      setWaktuPembaruan(new Date());
    } catch (error) {
      console.error("Gagal memuat dashboard:", error);

      setErrorDashboard(
        "Dashboard gagal mengambil data. Periksa koneksi backend."
      );

      if (manual) {
        tampilkanNotifikasi(
          "error",
          "Gagal memperbarui data",
          "Periksa koneksi server dan coba kembali."
        );
      }
    } finally {
      setLoadingDashboard(false);
    }
  }, [tampilkanNotifikasi]);

  useEffect(() => {
    muatDashboard();

    const interval = setInterval(() => {
      muatDashboard(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [muatDashboard]);

  // LOGOUT
  function handleLogout() {
    setShowLogoutPopup(true);
  }

  function batalLogout() {
    if (isLoggingOut) return;
    setShowLogoutPopup(false);
  }

  async function konfirmasiLogout() {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);

      await logoutSession();

      if (typeof onLogout === "function") {
        onLogout();
      } else {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Gagal logout:", error);

      setShowLogoutPopup(false);

      tampilkanNotifikasi(
        "error",
        "Logout gagal",
        "Sesi belum berhasil diakhiri. Periksa koneksi dan coba kembali."
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  function bukaMenu(menu) {
    setActiveMenu(menu);
  }

  // DASHBOARD CONTENT
  function renderDashboard() {
    const kartu = [
      {
        id: "alat",
        icon: "♫",
        warna: "teal",
        badge: "Inventaris",
        label: "Total Alat Musik",
        nilai: stats.alat,
        caption: "Data alat terdaftar",
        menu: "alat",
      },
      {
        id: "aktif",
        icon: "⇄",
        warna: "blue",
        badge: "Transaksi",
        label: "Peminjaman Aktif",
        nilai: stats.aktif,
        caption: "Transaksi yang sedang berjalan",
        menu: "peminjaman",
      },
      {
        id: "menunggu",
        icon: "◷",
        warna: "orange",
        badge: "Pemeriksaan",
        label: "Menunggu Persetujuan",
        nilai: stats.menunggu,
        caption: "Pengajuan yang perlu diperiksa",
        menu: "peminjaman",
      },
      {
        id: "pengguna",
        icon: "♙",
        warna: "purple",
        badge: "Akun",
        label: "Total Pengguna",
        nilai: stats.pengguna,
        caption: "Akun yang terdaftar",
        menu: "pengguna",
      },
    ];

    return (
      <>
        <section className="admin-welcome">
          <div className="admin-welcome-copy">
            <span className="admin-eyebrow">
              ADMINISTRATOR • MUSIKKU
            </span>

            <h2>Selamat datang, {namaAdmin}</h2>

            <p>
              Kelola sistem peminjaman alat musik dengan mudah.
              Pantau inventaris, transaksi, dan data pengguna dari
              satu tempat.
            </p>

            <button
              type="button"
              className="admin-welcome-button"
              onClick={() => bukaMenu("alat")}
            >
              Kelola Inventaris <span>→</span>
            </button>
          </div>

          <div className="admin-welcome-art" aria-hidden="true">
            ♫
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <span className="admin-section-kicker">OVERVIEW</span>
              <h2>Ringkasan Sistem</h2>
              <p>Informasi utama pengelolaan MusikKu.</p>
            </div>

            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => muatDashboard(true)}
              disabled={loadingDashboard}
            >
              {loadingDashboard ? "Memuat..." : "↻ Perbarui Data"}
            </button>
          </div>

          <div className="admin-stat-grid">
            {kartu.map((item) => (
              <button
                type="button"
                key={item.id}
                className="admin-stat-card admin-stat-card-button"
                onClick={() => bukaMenu(item.menu)}
                title={`Buka menu ${item.label}`}
              >
                <div className="admin-stat-top">
                  <span className={`admin-stat-icon ${item.warna}`}>
                    {item.icon}
                  </span>

                  <span className="admin-stat-badge">
                    {item.badge}
                  </span>
                </div>

                <p className="admin-stat-label">{item.label}</p>

                <h3>
                  {loadingDashboard && item.nilai === null
                    ? "..."
                    : item.nilai === null
                      ? "!"
                      : item.nilai.toLocaleString("id-ID")}
                </h3>

                <span className="admin-stat-caption">
                  {item.nilai === null && !loadingDashboard
                    ? "Data belum tersedia"
                    : item.caption}
                </span>
              </button>
            ))}
          </div>

          {errorDashboard && (
            <div className="admin-dashboard-error" role="alert">
              <strong>Data belum lengkap</strong>
              <p>{errorDashboard}</p>
              <small>
                Periksa route backend dan konfigurasi API.
              </small>
            </div>
          )}

          {waktuPembaruan && (
            <p className="admin-last-updated">
              Terakhir diperbarui:{" "}
              {waktuPembaruan.toLocaleTimeString("id-ID")}
            </p>
          )}
        </section>

        <section className="admin-data-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-section-kicker">TRANSAKSI</span>
              <h2>Aktivitas Peminjaman</h2>
              <p>Daftar lima pengajuan peminjaman terbaru.</p>
            </div>

            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => bukaMenu("peminjaman")}
            >
              Lihat Peminjaman →
            </button>
          </div>

          {loadingDashboard ? (
            <div className="admin-empty">
              <div className="admin-empty-icon">↻</div>
              <h3>Memuat transaksi</h3>
              <p>Dashboard sedang mengambil data dari server.</p>
            </div>
          ) : peminjamanTerbaru.length > 0 ? (
            <div className="admin-dashboard-table-wrap">
              <table className="admin-dashboard-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Peminjam</th>
                    <th>Alat Musik</th>
                    <th>Tanggal</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {peminjamanTerbaru.map((item, index) => {
                    const status = ambilStatus(item);

                    return (
                      <tr key={`${ambilId(item)}-${index}`}>
                        <td>#{ambilId(item)}</td>
                        <td>{ambilNamaPeminjam(item)}</td>
                        <td>{ambilNamaAlat(item)}</td>
                        <td>
                          {formatTanggal(
                            item.tanggal_pinjam ||
                            item.tanggal_peminjaman ||
                            item.tanggal_pengajuan ||
                            item.created_at
                          )}
                        </td>
                        <td>
                          <span
                            className={`admin-dashboard-status status-${status}`}
                          >
                            {labelStatus(status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty">
              <div className="admin-empty-icon">⇄</div>
              <h3>
                {errorDashboard
                  ? "Transaksi belum dapat ditampilkan"
                  : "Belum ada peminjaman"}
              </h3>
              <p>
                {errorDashboard
                  ? "Periksa endpoint peminjaman pada backend."
                  : "Data akan muncul setelah peminjam membuat pengajuan."}
              </p>

              <button
                type="button"
                className="admin-secondary-button"
                onClick={() => bukaMenu("peminjaman")}
              >
                Buka Menu Peminjaman →
              </button>
            </div>
          )}
        </section>

        <section className="admin-data-panel admin-shortcuts">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-section-kicker">AKSES CEPAT</span>
              <h2>Pengelolaan Data</h2>
              <p>Pilih fitur administrasi yang ingin dibuka.</p>
            </div>
          </div>

          <div className="admin-shortcut-list">
            {menus
              .filter((menu) => menu.id !== "dashboard")
              .map((menu) => (
                <button
                  type="button"
                  key={menu.id}
                  className="admin-shortcut"
                  onClick={() => bukaMenu(menu.id)}
                >
                  <span className="admin-shortcut-icon">
                    {menu.icon}
                  </span>

                  <span className="admin-shortcut-text">
                    <strong>{menu.label}</strong>
                    <small>{descriptions[menu.id]}</small>
                  </span>

                  <span className="admin-shortcut-arrow">→</span>
                </button>
              ))}
          </div>
        </section>
      </>
    );
  }

  function renderPage() {
    switch (activeMenu) {
      case "dashboard":
        return renderDashboard();
      case "pengguna":
        return <User />;
      case "alat":
        return <AlatMusik />;
      case "kategori":
        return <Kategori />;
      case "peminjaman":
        return <Peminjaman />;
      case "pengembalian":
        return <Pengembalian />;
      case "aktivitas":
        return <LogAktivitas />;
      default:
        return renderDashboard();
    }
  }

  return (
    <div className="admin-layout">

      {/* SIDEBAR */}
      <aside className="admin-sidebar">
        <button
          type="button"
          className="admin-brand"
          onClick={() => bukaMenu("dashboard")}
          aria-label="Kembali ke Dashboard MusikKu"
        >
          <div className="admin-brand-icon">♫</div>
          <div>
            <h2>Musik<span>Ku.</span></h2>
            <p>ADMIN PANEL</p>
          </div>
        </button>

        <div className="admin-sidebar-divider" />

        <p className="admin-menu-title">MENU UTAMA</p>

        <nav className="admin-nav">
          {menus.map((menu) => (
            <button
              type="button"
              key={menu.id}
              className={`admin-nav-item ${
                activeMenu === menu.id ? "active" : ""
              }`}
              onClick={() => bukaMenu(menu.id)}
              aria-current={
                activeMenu === menu.id ? "page" : undefined
              }
            >
              <span className="admin-nav-icon">{menu.icon}</span>
              <span>{menu.label}</span>

              {menu.id === "pengembalian" &&
                menungguPengembalian > 0 && (
                  <span className="admin-nav-badge">
                    {menungguPengembalian}
                  </span>
                )}

              {activeMenu === menu.id && (
                <span className="admin-nav-indicator" />
              )}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-sidebar-user">
            <div className="admin-avatar">
              {String(namaAdmin).charAt(0).toUpperCase()}
            </div>

            <div className="admin-profile-text">
              <strong>{namaAdmin}</strong>
              <p>Administrator</p>
            </div>
          </div>

          <button
            type="button"
            className="admin-logout"
            onClick={handleLogout}
          >
            <span>⇥</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-heading">
            <p className="admin-breadcrumb">
              MusikKu / {activeLabel}
            </p>

            <h1>{activeLabel}</h1>

            <p className="admin-topbar-description">
              Sistem Informasi Peminjaman Alat Musik
            </p>
          </div>

          <div className="admin-profile">
            <div className="admin-avatar">
              {String(namaAdmin).charAt(0).toUpperCase()}
            </div>

            <div className="admin-profile-text">
              <strong>{namaAdmin}</strong>
              <p>Administrator</p>
            </div>
          </div>
        </header>

        <div className="admin-content">
          {renderPage()}
        </div>

        <footer className="admin-footer">
          © {new Date().getFullYear()} MusikKu · Sistem Peminjaman
          Alat Musik
        </footer>
      </main>

      {/* CUSTOM TOAST NOTIFICATION */}
      {toast && (
        <div
          key={toast.id}
          className={`admin-toast admin-toast-${toast.jenis}`}
          role="status"
          aria-live="polite"
        >
          <div className="admin-toast-icon">
            {toast.jenis === "success" && "✓"}
            {toast.jenis === "error" && "✕"}
            {toast.jenis === "warning" && "!"}
            {toast.jenis === "info" && "i"}
          </div>

          <div className="admin-toast-content">
            <strong>{toast.judul}</strong>
            <p>{toast.pesan}</p>
          </div>

          <button
            type="button"
            className="admin-toast-close"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
          >
            ×
          </button>

          <div className="admin-toast-progress" />
        </div>
      )}

      {/* LOGOUT CONFIRMATION */}
      {showLogoutPopup && (
        <div
          className="admin-logout-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isLoggingOut
            ) {
              batalLogout();
            }
          }}
        >
          <section
            className="admin-logout-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-logout-title"
            aria-describedby="admin-logout-description"
          >
            <div className="admin-logout-popup-icon">
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
              </svg>
            </div>

            <span className="admin-logout-kicker">
              MUSIKKU SECURITY
            </span>

            <h2 id="admin-logout-title">
              Konfirmasi Logout
            </h2>

            <p id="admin-logout-description">
              Apakah kamu yakin ingin keluar dari akun
              administrator MusikKu? Sesi login akan diakhiri.
            </p>

            <div className="admin-logout-actions">
              <button
                type="button"
                className="admin-logout-cancel"
                onClick={batalLogout}
                disabled={isLoggingOut}
              >
                Batal
              </button>

              <button
                type="button"
                className="admin-logout-confirm"
                onClick={konfirmasiLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Memproses..." : "Ya, Logout"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
