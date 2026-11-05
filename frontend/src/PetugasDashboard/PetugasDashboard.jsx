import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "./PetugasDashboard.css";
import {
  API_BASE_URL,
  logoutSession,
  notifySessionExpired,
} from "../api.js";

const PEMINJAMAN_URL = `${API_BASE_URL}/peminjaman`;
const PENGEMBALIAN_URL = `${API_BASE_URL}/pengembalian`;

const menus = [
  { id: "dashboard", icon: "⌂", label: "Dashboard" },
  { id: "peminjaman", icon: "✓", label: "Menyetujui Peminjaman" },
  { id: "pengembalian", icon: "↩", label: "Memantau Pengembalian" },
  { id: "laporan", icon: "▤", label: "Mencetak Laporan" },
];

const statusLabel = {
  menunggu: "Menunggu Pemeriksaan",
  menunggu_pengembalian: "Menunggu Pemeriksaan",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
  dipinjam: "Sedang Dipinjam",
  dipinjamkan: "Sudah Dipinjamkan",
  terlambat: "Terlambat",
  dikembalikan: "Dikembalikan",
  selesai: "Selesai",
  belum_kembali: "Belum Kembali",
};

const formatTanggal = (tanggal) => {
  if (!tanggal) return "-";

  const raw = String(tanggal).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  return "-";
};

const tanggalHariIni = () => {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");

  return `${tahun}-${bulan}-${hari}`;
};

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

function normalisasiStatus(status) {
  return String(status || "menunggu")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function ambilArray(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function getId(item) {
  return item.id ?? item.id_peminjaman ?? item.peminjaman_id;
}

function getNamaPeminjam(item) {
  return (
    item.nama_peminjam ||
    item.nama ||
    item.username ||
    item.user?.nama ||
    item.peminjam?.nama ||
    "-"
  );
}

function getNamaAlat(item) {
  if (item.nama_alat) return item.nama_alat;

  if (Array.isArray(item.items) && item.items.length) {
    return item.items
      .map((alat) => {
        const nama = alat.nama_alat || alat.nama || "Alat";
        const jumlah = Number(alat.jumlah) || 1;
        return `${nama} (${jumlah})`;
      })
      .join(", ");
  }

  return (
    item.alat?.nama_alat ||
    item.alat?.nama ||
    item.nama ||
    "-"
  );
}

function isMenungguPengembalian(item) {
  return [
    "menunggu",
    "menunggu_pengembalian",
    "belum_kembali",
  ].includes(normalisasiStatus(item.status));
}

function getTanggalPengembalian(item) {
  return (
    item.tanggal_kembali ||
    item.tanggal_pengembalian ||
    ""
  );
}

function getIdPengembalian(item) {
  return item.id_pengembalian ?? item.id;
}

export default function PetugasDashboard({ onLogout }) {
  const [active, setActive] = useState("dashboard");
  const [data, setData] = useState([]);
  const [dataPengembalian, setDataPengembalian] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pesan, setPesan] = useState("");
  const [aksiLoading, setAksiLoading] = useState(null);
  const [user, setUser] = useState({});
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const cancelButtonRef = useRef(null);

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem("user") || "{}"));
    } catch {
      setUser({});
    }
  }, []);

  const nama = user.nama || user.username || "Petugas";
  const inisial = String(nama).charAt(0).toUpperCase();

  // Fokus otomatis ke tombol batal & dukungan tombol Escape saat popup terbuka
  useEffect(() => {
    if (!showLogoutPopup) return;

    const timer = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 50);

    const handleKey = (event) => {
      if (event.key === "Escape" && !logoutLoading) {
        setShowLogoutPopup(false);
      }
    };

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [showLogoutPopup, logoutLoading]);

  const request = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error(
        "Token login tidak ditemukan. Silakan login kembali."
      );
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    };

    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get("content-type") || "";
    let result;

    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      result = {
        message: await response.text(),
      };
    }

    if (!response.ok) {
      if (response.status === 401) {
        notifySessionExpired();
        throw new Error(
          "Sesi login berakhir. Silakan login kembali."
        );
      }

      throw new Error(
        result.message || `Permintaan gagal (${response.status})`
      );
    }

    return result;
  }, []);

  // MEMUAT DATA PEMINJAMAN DAN PENGEMBALIAN
  const muatData = useCallback(async (options = {}) => {
    const { silent = false } = options;

    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const hasil = await Promise.allSettled([
        request(PEMINJAMAN_URL),
        request(PENGEMBALIAN_URL),
      ]);

      const daftarError = [];

      if (hasil[0].status === "fulfilled") {
        setData(ambilArray(hasil[0].value));
      } else {
        daftarError.push(
          `Peminjaman: ${
            hasil[0].reason?.message || "Gagal memuat data"
          }`
        );
      }

      if (hasil[1].status === "fulfilled") {
        setDataPengembalian(ambilArray(hasil[1].value));
      } else {
        daftarError.push(
          `Pengembalian: ${
            hasil[1].reason?.message || "Gagal memuat data"
          }`
        );
      }

      if (daftarError.length) {
        setError(daftarError.join(" | "));
      } else if (silent) {
        setError("");
      }
    } catch (err) {
      setError(err.message || "Gagal mengambil data.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    muatData();

    const interval = setInterval(() => {
      muatData({ silent: true });
    }, 30000);

    return () => clearInterval(interval);
  }, [muatData]);

  // AKSI PEMINJAMAN
  async function prosesAksiPeminjaman(id, aksi, pertanyaan) {
    if (id == null) {
      setError("ID peminjaman tidak ditemukan.");
      return;
    }

    const endpointAksi = {
      setujui: "setujui",
      tolak: "tolak",
      dipinjamkan: "pinjamkan",
    };

    const endpoint = endpointAksi[aksi];

    if (!endpoint) {
      setError("Aksi peminjaman tidak valid.");
      return;
    }

    if (!window.confirm(pertanyaan)) return;

    setError("");
    setPesan("");
    setAksiLoading(`${id}-${aksi}`);

    try {
      const result = await request(
        `${PEMINJAMAN_URL}/${id}/${endpoint}`,
        { method: "PATCH" }
      );

      setPesan(
        result.message || "Status peminjaman berhasil diperbarui."
      );

      await muatData();
    } catch (err) {
      setError(err.message || "Gagal memproses peminjaman.");
    } finally {
      setAksiLoading(null);
    }
  }

  // KONFIRMASI PENGEMBALIAN
  async function konfirmasiPengembalian(item) {
    const id = getIdPengembalian(item);

    if (id == null) {
      setError("ID pengembalian tidak ditemukan.");
      return;
    }

    if (!isMenungguPengembalian(item)) {
      setError(
        "Pengembalian ini sudah diproses atau tidak menunggu pemeriksaan."
      );
      return;
    }

    const namaAlat = getNamaAlat(item);

    if (
      !window.confirm(
        `Pastikan kondisi ${namaAlat} sudah diperiksa. Konfirmasi pengembalian ini?`
      )
    ) {
      return;
    }

    setError("");
    setPesan("");
    setAksiLoading(`pengembalian-${id}`);

    try {
      const result = await request(
        `${PENGEMBALIAN_URL}/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            tanggal_kembali:
              String(getTanggalPengembalian(item)).slice(0, 10) ||
              tanggalHariIni(),
            kondisi_kembali: item.kondisi_kembali || "baik",
            catatan: item.catatan || "",
            status: "dikembalikan",
          }),
        }
      );

      setPesan(
        result.message || "Pengembalian berhasil dikonfirmasi."
      );

      await muatData();
    } catch (err) {
      setError(err.message || "Gagal memproses pengembalian.");
    } finally {
      setAksiLoading(null);
    }
  }

  // LOGOUT
  function bukaLogout() {
    setShowLogoutPopup(true);
  }

  function batalLogout() {
    if (logoutLoading) return;
    setShowLogoutPopup(false);
  }

  async function konfirmasiLogout() {
    setLogoutLoading(true);

    try {
      await logoutSession();
    } catch {
      // Lanjutkan logout lokal meskipun API gagal
    } finally {
      setLogoutLoading(false);
    }

    if (typeof onLogout === "function") {
      onLogout();
    } else {
      window.location.href = "/";
    }
  }

  // RINGKASAN DASHBOARD
  const menunggu = useMemo(
    () =>
      data.filter(
        (item) =>
          normalisasiStatus(item.status) === "menunggu"
      ).length,
    [data]
  );

  const disetujui = useMemo(
    () =>
      data.filter(
        (item) =>
          normalisasiStatus(item.status) === "disetujui"
      ).length,
    [data]
  );

  const dipinjam = useMemo(
    () =>
      data.filter((item) =>
        ["dipinjam", "terlambat"].includes(
          normalisasiStatus(item.status)
        )
      ).length,
    [data]
  );

  const menungguPengembalian = useMemo(
    () => dataPengembalian.filter(isMenungguPengembalian).length,
    [dataPengembalian]
  );

  const selesai = useMemo(
    () =>
      data.filter((item) =>
        ["selesai", "dikembalikan"].includes(
          normalisasiStatus(item.status)
        )
      ).length,
    [data]
  );

  const activeLabel =
    menus.find((menu) => menu.id === active)?.label || "Dashboard";

  const daftarPeminjaman = useMemo(
    () =>
      data.filter((item) =>
        ["menunggu", "disetujui"].includes(
          normalisasiStatus(item.status)
        )
      ),
    [data]
  );

  const daftarPengembalian = dataPengembalian;

  function cetakLaporan() {
    window.print();
  }

  // TABEL PEMINJAMAN
  function renderTabelPeminjaman() {
    if (loading && data.length === 0) {
      return (
        <p className="staff-message">
          Memuat data peminjaman...
        </p>
      );
    }

    if (!daftarPeminjaman.length) {
      return (
        <p className="staff-message">
          Belum ada pengajuan peminjaman yang menunggu persetujuan
          atau penyerahan alat.
        </p>
      );
    }

    return (
      <div className="staff-table-scroll">
        <table className="staff-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Nama Peminjam</th>
              <th>Nama Alat</th>
              <th>Tanggal Pinjam</th>
              <th>Rencana Kembali</th>
              <th>Jaminan</th>
              <th>Status</th>
              <th className="no-print">Tindakan</th>
            </tr>
          </thead>

          <tbody>
            {daftarPeminjaman.map((item, index) => {
              const id = getId(item);
              const status = normalisasiStatus(item.status);

              return (
                <tr key={id ?? index}>
                  <td>{index + 1}</td>
                  <td>{getNamaPeminjam(item)}</td>
                  <td>{getNamaAlat(item)}</td>
                  <td>{formatTanggal(item.tanggal_pinjam)}</td>
                  <td>
                    {formatTanggal(item.tanggal_rencana_kembali)}
                  </td>
                  <td>
                    {item.jaminan || item.jenis_jaminan || "-"}
                  </td>
                  <td>
                    <span
                      className={`staff-status status-${status}`}
                    >
                      {statusLabel[status] || item.status || "-"}
                    </span>
                  </td>

                  <td className="no-print staff-actions">
                    {status === "menunggu" && (
                      <>
                        <button
                          type="button"
                          className="staff-action approve"
                          disabled={aksiLoading !== null}
                          onClick={() =>
                            prosesAksiPeminjaman(
                              id,
                              "setujui",
                              "Setujui pengajuan peminjaman ini?"
                            )
                          }
                        >
                          {aksiLoading === `${id}-setujui`
                            ? "Memproses..."
                            : "Setujui"}
                        </button>

                        <button
                          type="button"
                          className="staff-action reject"
                          disabled={aksiLoading !== null}
                          onClick={() =>
                            prosesAksiPeminjaman(
                              id,
                              "tolak",
                              "Tolak pengajuan peminjaman ini?"
                            )
                          }
                        >
                          {aksiLoading === `${id}-tolak`
                            ? "Memproses..."
                            : "Tolak"}
                        </button>
                      </>
                    )}

                    {status === "disetujui" && (
                      <button
                        type="button"
                        className="staff-action approve"
                        disabled={aksiLoading !== null}
                        onClick={() =>
                          prosesAksiPeminjaman(
                            id,
                            "dipinjamkan",
                            "Pastikan alat sudah diserahkan kepada peminjam. Lanjutkan?"
                          )
                        }
                      >
                        {aksiLoading === `${id}-dipinjamkan`
                          ? "Memproses..."
                          : "Dipinjamkan"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // TABEL PENGEMBALIAN
  function renderTabelPengembalian() {
    if (loading && dataPengembalian.length === 0) {
      return (
        <p className="staff-message">
          Memuat data pengembalian...
        </p>
      );
    }

    if (!daftarPengembalian.length) {
      return (
        <p className="staff-message">
          Belum ada catatan pengembalian di database.
          Pastikan peminjam sudah mengajukan pengembalian.
        </p>
      );
    }

    return (
      <div className="staff-table-scroll">
        <table className="staff-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Nama Peminjam</th>
              <th>Nama Alat</th>
              <th>Rencana Kembali</th>
              <th>Tanggal Pengembalian</th>
              <th>Kondisi</th>
              <th>Denda</th>
              <th>Status</th>
              <th className="no-print">Tindakan</th>
            </tr>
          </thead>

          <tbody>
            {daftarPengembalian.map((item, index) => {
              const id = getIdPengembalian(item);
              const status = normalisasiStatus(item.status);
              const menungguPemeriksaan =
                isMenungguPengembalian(item);
              const sedangDiproses =
                aksiLoading === `pengembalian-${id}`;

              return (
                <tr key={id ?? index}>
                  <td>{index + 1}</td>
                  <td>{getNamaPeminjam(item)}</td>
                  <td>{getNamaAlat(item)}</td>
                  <td>
                    {formatTanggal(item.tanggal_rencana_kembali)}
                  </td>
                  <td>
                    {formatTanggal(getTanggalPengembalian(item))}
                  </td>
                  <td>{item.kondisi_kembali || "-"}</td>
                  <td>{formatRupiah(item.denda)}</td>
                  <td>
                    <span
                      className={`staff-status status-${status}`}
                    >
                      {statusLabel[status] || item.status || "-"}
                    </span>
                  </td>

                  <td className="no-print staff-actions">
                    {menungguPemeriksaan ? (
                      <button
                        type="button"
                        className="staff-action approve"
                        disabled={aksiLoading !== null}
                        onClick={() =>
                          konfirmasiPengembalian(item)
                        }
                      >
                        {sedangDiproses
                          ? "Memproses..."
                          : "Konfirmasi Kembali"}
                      </button>
                    ) : (
                      <span>
                        {["dikembalikan", "selesai"].includes(status)
                          ? "Sudah diproses"
                          : "Tidak ada tindakan"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // TABEL LAPORAN
  function renderTabelLaporan() {
    const daftarLaporan = [
      ...data.map((item) => ({
        ...item,
        jenis_data: "Peminjaman",
        tanggal_aktivitas:
          item.tanggal_pinjam || item.created_at,
      })),

      ...dataPengembalian.map((item) => ({
        ...item,
        jenis_data: "Pengembalian",
        tanggal_aktivitas:
          getTanggalPengembalian(item) || item.created_at,
      })),
    ];

    if (!daftarLaporan.length) {
      return (
        <p className="staff-message">
          Belum ada data untuk laporan.
        </p>
      );
    }

    return (
      <div className="staff-table-scroll">
        <table className="staff-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Jenis</th>
              <th>Nama Peminjam</th>
              <th>Nama Alat</th>
              <th>Tanggal</th>
              <th>Status</th>
              <th>Denda</th>
            </tr>
          </thead>

          <tbody>
            {daftarLaporan.map((item, index) => {
              const status = normalisasiStatus(item.status);

              return (
                <tr
                  key={`${item.jenis_data}-${getId(item)}-${index}`}
                >
                  <td>{index + 1}</td>
                  <td>{item.jenis_data}</td>
                  <td>{getNamaPeminjam(item)}</td>
                  <td>{getNamaAlat(item)}</td>
                  <td>{formatTanggal(item.tanggal_aktivitas)}</td>
                  <td>
                    {statusLabel[status] || item.status || "-"}
                  </td>
                  <td>
                    {item.jenis_data === "Pengembalian"
                      ? formatRupiah(item.denda)
                      : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // KONTEN DASHBOARD
  function renderContent() {
    if (active === "dashboard") {
      return (
        <>
          <section className="staff-hero">
            <span className="staff-eyebrow">
              PANEL OPERASIONAL
            </span>

            <h2>Selamat bertugas, {nama}</h2>

            <p>
              Kelola persetujuan peminjaman, pantau pengembalian
              alat musik, dan cetak laporan aktivitas MusikKu.
            </p>

            <button
              type="button"
              onClick={() => setActive("peminjaman")}
            >
              Periksa Pengajuan 
            </button>
          </section>

          {menungguPengembalian > 0 && (
            <button
              type="button"
              className="staff-return-alert"
              onClick={() => setActive("pengembalian")}
            >
              <span>⏳</span>

              <div>
                <strong>
                  {menungguPengembalian} pengembalian menunggu
                  verifikasi
                </strong>
                <small>
                  Klik untuk memeriksa kondisi alat dan
                  mengonfirmasi pengembalian.
                </small>
              </div>

              <b>→</b>
            </button>
          )}

          <section className="staff-stats">
            <article>
              <span className="staff-stat-icon">◷</span>
              <p>Pengajuan Menunggu</p>
              <h3>{menunggu}</h3>
            </article>

            <article>
              <span className="staff-stat-icon">✓</span>
              <p>Menunggu Penyerahan</p>
              <h3>{disetujui}</h3>
            </article>

            <article>
              <span className="staff-stat-icon">♫</span>
              <p>Alat Sedang Dipinjam</p>
              <h3>{dipinjam}</h3>
            </article>

            <article>
              <span className="staff-stat-icon">↩</span>
              <p>Pengembalian Menunggu</p>
              <h3>{menungguPengembalian}</h3>
            </article>

            <article>
              <span className="staff-stat-icon">✓</span>
              <p>Peminjaman Selesai</p>
              <h3>{selesai}</h3>
            </article>
          </section>

          <section className="staff-panel">
            <div className="staff-section-heading">
              <div>
                <h2>Tugas Petugas</h2>
                <p>Pilih pekerjaan yang ingin dilakukan.</p>
              </div>
            </div>

            <div className="staff-quick-actions">
              {menus.slice(1).map((menu) => (
                <button
                  type="button"
                  key={menu.id}
                  onClick={() => setActive(menu.id)}
                >
                  <span>{menu.icon}</span>
                  <strong>{menu.label}</strong>

                  <small>
                    {menu.id === "peminjaman"
                      ? `${menunggu + disetujui} pengajuan perlu diproses`
                      : menu.id === "pengembalian"
                        ? `${menungguPengembalian} pengembalian menunggu pemeriksaan`
                        : `${data.length + dataPengembalian.length} catatan tersedia`}
                  </small>
                </button>
              ))}
            </div>
          </section>
        </>
      );
    }

    return (
      <section className="staff-panel">
        <div className="staff-section-heading">
          <div>
            <h2>{activeLabel}</h2>

            <p>
              {active === "peminjaman"
                ? "Setujui, tolak, dan konfirmasi penyerahan alat."
                : active === "pengembalian"
                  ? "Periksa kondisi alat dan konfirmasi pengembalian."
                  : "Rekap data peminjaman dan pengembalian MusikKu."}
            </p>
          </div>

          <div className="staff-heading-actions no-print">
            <button
              type="button"
              className="staff-action"
              onClick={muatData}
              disabled={loading}
            >
              {loading ? "Memuat..." : "Muat Ulang"}
            </button>

            {active === "laporan" && (
              <button
                type="button"
                className="staff-action approve"
                onClick={cetakLaporan}
              >
                Cetak Laporan
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="staff-error" role="alert">
            {error}
          </div>
        )}

        {pesan && (
          <div className="staff-success" role="status">
            {pesan}
          </div>
        )}

        {active === "laporan" && (
          <div className="staff-report-summary">
            <span>
              Total peminjaman: <strong>{data.length}</strong>
            </span>

            <span>
              Total pengembalian:{" "}
              <strong>{dataPengembalian.length}</strong>
            </span>

            <span>
              Menunggu: <strong>{menunggu}</strong>
            </span>

            <span>
              Selesai: <strong>{selesai}</strong>
            </span>
          </div>
        )}

        {active === "peminjaman" && renderTabelPeminjaman()}

        {active === "pengembalian" &&
          renderTabelPengembalian()}

        {active === "laporan" && renderTabelLaporan()}
      </section>
    );
  }

  return (
    <div className="staff-layout">
      <aside className="staff-sidebar">
        <div className="staff-brand">
          <span>♫</span>

          <div>
            <h2>
              Musik<span>Ku.</span>
            </h2>
            <p>PANEL PETUGAS</p>
          </div>
        </div>

        <p className="staff-menu-title">MENU UTAMA</p>

        <nav className="staff-nav">
          {menus.map((menu) => (
            <button
              type="button"
              key={menu.id}
              className={active === menu.id ? "active" : ""}
              onClick={() => {
                setActive(menu.id);
                setError("");
                setPesan("");
              }}
            >
              <span>{menu.icon}</span>
              {menu.label}
              {menu.id === "pengembalian" &&
                menungguPengembalian > 0 && (
                  <span className="staff-nav-badge">
                    {menungguPengembalian}
                  </span>
                )}
            </button>
          ))}
        </nav>

        <div className="staff-sidebar-bottom">
          {/* Profil + tombol logout digabung dalam satu kartu */}
          <button
            type="button"
            className="staff-profile-logout"
            onClick={bukaLogout}
            title="Klik untuk keluar dari akun"
            aria-label="Keluar dari akun"
          >
            <span className="staff-profile-avatar">
              {inisial}
            </span>

            <span className="staff-profile-info">
              <strong>{nama}</strong>
              <small>Petugas</small>
            </span>

            <span className="staff-profile-exit" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
              </svg>
            </span>
          </button>
        </div>
      </aside>

      <main className="staff-main">
        <header className="staff-topbar">
          <div className="topbar-title">
            <p>MusikKu / {activeLabel}</p>
            <h1>{activeLabel}</h1>
          </div>

          {/* Profil & Logout disatukan (Kanan) mirip referensi */}
          <button
            type="button"
            className="topbar-profile-btn"
            onClick={bukaLogout}
            title="Klik untuk keluar dari akun"
            aria-label="Keluar dari akun"
          >
            <div className="topbar-avatar">{inisial}</div>
            <span className="topbar-username">{nama}</span>
            <span className="topbar-logout-text">Keluar</span>
          </button>
        </header>

        <div className="staff-content">
          {renderContent()}
        </div>

        <footer className="staff-footer">
          © {new Date().getFullYear()} MusikKu — Panel Petugas.
        </footer>
      </main>

      {showLogoutPopup && (
        <div
          className="logout-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              batalLogout();
            }
          }}
        >
          <div
            className="logout-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-description"
          >
            <button
              type="button"
              className="logout-close"
              onClick={batalLogout}
              aria-label="Tutup dialog"
              disabled={logoutLoading}
            >
              ✕
            </button>

            <div className="logout-icon">
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

            <span className="logout-eyebrow">
              KONFIRMASI LOGOUT
            </span>

            <h2 id="logout-title">Keluar dari MusikKu?</h2>

            <p id="logout-description">
              Sesi login sebagai <strong>{nama}</strong> akan
              diakhiri. Kamu perlu login kembali untuk mengakses
              panel petugas.
            </p>

            <div className="logout-actions">
              <button
                type="button"
                className="logout-cancel"
                onClick={batalLogout}
                ref={cancelButtonRef}
                disabled={logoutLoading}
              >
                Batal
              </button>

              <button
                type="button"
                className="logout-confirm"
                onClick={konfirmasiLogout}
                disabled={logoutLoading}
              >
                {logoutLoading ? "Memproses..." : "Ya, Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}