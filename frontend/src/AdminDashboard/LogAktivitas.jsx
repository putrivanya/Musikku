
import { useCallback, useEffect, useState } from "react";
import "./LogAktivitas.css";
import { API_BASE_URL, notifySessionExpired } from "../api.js";

const API = `${API_BASE_URL}/log-aktivitas`;

function tanggalHariIni() {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");

  return `${tahun}-${bulan}-${hari}`;
}

function formatTanggal(value) {
  if (!value) return "-";

  const tanggal = String(value).replace(" ", "T");
  const date = new Date(tanggal);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.results)) return result.results;

  return [];
}

async function parseResponse(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      message: text || "Respons server tidak valid.",
    };
  }
}

export default function LogAktivitas() {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");

  // Default pencatatan hanya dimulai dari hari ini.
  const [dari, setDari] = useState(tanggalHariIni());
  const [sampai, setSampai] = useState(tanggalHariIni());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [waktuUpdate, setWaktuUpdate] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Token login tidak ditemukan. Silakan login kembali.");
      }

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (dari) params.set("dari", dari);
      if (sampai) params.set("sampai", sampai);

      const response = await fetch(`${API}?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await parseResponse(response);

      if (!response.ok) {
        if (response.status === 401) {
          notifySessionExpired();
        }

        throw new Error(
          result.message || `Gagal mengambil data (${response.status}).`
        );
      }

      const daftar = getRows(result);

      // Mendukung nama kolom waktu maupun created_at.
      const hasilFilter = daftar.filter((item) => {
        const waktu = item.waktu || item.created_at;

        if (!waktu) return false;

        const tanggal = String(waktu).slice(0, 10);

        if (dari && tanggal < dari) return false;
        if (sampai && tanggal > sampai) return false;

        return true;
      });

      // Urutkan aktivitas terbaru di bagian atas.
      hasilFilter.sort((a, b) => {
        const waktuA = a.waktu || a.created_at || "";
        const waktuB = b.waktu || b.created_at || "";

        return String(waktuB).localeCompare(String(waktuA));
      });

      setData(hasilFilter);
      setWaktuUpdate(new Date());
    } catch (err) {
      console.error("Gagal memuat log aktivitas:", err);
      setData([]);
      setError(err.message || "Tidak dapat menghubungi server.");
    } finally {
      setLoading(false);
    }
  }, [search, dari, sampai]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function resetFilter() {
    const hariIni = tanggalHariIni();

    setSearch("");
    setDari(hariIni);
    setSampai(hariIni);
  }

  function getJenisAktivitas(aktivitas) {
    const teks = String(aktivitas || "").toLowerCase();

    if (teks.includes("tambah") || teks.includes("menambahkan")) {
      return "tambah";
    }

    if (
      teks.includes("edit") ||
      teks.includes("ubah") ||
      teks.includes("update")
    ) {
      return "edit";
    }

    if (teks.includes("hapus") || teks.includes("menghapus")) {
      return "hapus";
    }

    if (teks.includes("setujui") || teks.includes("menyetujui")) {
      return "setuju";
    }

    if (teks.includes("tolak") || teks.includes("menolak")) {
      return "tolak";
    }

    if (teks.includes("kembali") || teks.includes("pengembalian")) {
      return "kembali";
    }

    return "lainnya";
  }

  function cetakLaporan() {
    window.print();
  }

  return (
    <main className="log-page">
      <header className="log-heading">
        <div>
          <span className="log-eyebrow">MONITORING MUSIKKU</span>
          <h2>Log Aktivitas</h2>
          <p>
            Catatan aktivitas admin, petugas, dan peminjam mulai hari ini.
          </p>
        </div>

        <div className="log-actions">
          <button
            type="button"
            className="log-refresh"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Memuat..." : "↻ Muat Ulang"}
          </button>

          <button
            type="button"
            className="log-print-button"
            onClick={cetakLaporan}
            disabled={data.length === 0}
          >
            Cetak Laporan
          </button>
        </div>
      </header>

      <section className="log-summary">
        <div className="log-summary-card">
          <span className="log-summary-icon">◷</span>
          <div>
            <p>Total Aktivitas</p>
            <h3>{data.length}</h3>
            <small>Aktivitas pada periode terpilih</small>
          </div>
        </div>

        <div className="log-summary-card">
          <span className="log-summary-icon">▦</span>
          <div>
            <p>Periode Aktivitas</p>
            <h3>{dari === sampai ? "Hari Ini" : "Rentang Tanggal"}</h3>
            <small>{dari || "-"} sampai {sampai || "-"}</small>
          </div>
        </div>
      </section>

      {error && (
        <div className="log-alert" role="alert">
          <strong>Gagal memuat log aktivitas</strong>
          <p>{error}</p>
        </div>
      )}

      <section className="log-card">
        <div className="log-table-heading">
          <div>
            <h3>Riwayat Aktivitas</h3>
            <p>Aktivitas yang tercatat berdasarkan tanggal pilihan.</p>
          </div>

          <div className="log-filters">
            <input
              className="log-search"
              type="search"
              placeholder="Cari aktivitas atau pengguna..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <label>
              Dari
              <input
                type="date"
                value={dari}
                max={sampai || undefined}
                onChange={(event) => setDari(event.target.value)}
              />
            </label>

            <label>
              Sampai
              <input
                type="date"
                value={sampai}
                min={dari || undefined}
                onChange={(event) => setSampai(event.target.value)}
              />
            </label>

            <button
              type="button"
              className="log-reset"
              onClick={resetFilter}
            >
              Hari Ini
            </button>
          </div>
        </div>

        {loading ? (
          <div className="log-state">
            Memuat riwayat aktivitas...
          </div>
        ) : (
          <div className="log-table-wrap">
            <table className="log-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>ID</th>
                  <th>Pengguna</th>
                  <th>Aktivitas</th>
                  <th>Jenis</th>
                  <th>Waktu</th>
                </tr>
              </thead>

              <tbody>
                {data.map((item, index) => {
                  const jenis = getJenisAktivitas(item.aktivitas);
                  const waktu = item.waktu || item.created_at;

                  return (
                    <tr key={item.id || `${waktu}-${index}`}>
                      <td>{index + 1}</td>
                      <td>#{item.id || "-"}</td>

                      <td>
                        <strong>
                          {item.nama_pengguna ||
                            `User ${item.user_id || "-"}`}
                        </strong>
                      </td>

                      <td>
                        <span className="log-activity">
                          {item.aktivitas || "-"}
                        </span>
                      </td>

                      <td>
                        <span className={`log-type ${jenis}`}>
                          {jenis === "tambah"
                            ? "Tambah"
                            : jenis === "edit"
                            ? "Edit"
                            : jenis === "hapus"
                            ? "Hapus"
                            : jenis === "setuju"
                            ? "Persetujuan"
                            : jenis === "tolak"
                            ? "Penolakan"
                            : jenis === "kembali"
                            ? "Pengembalian"
                            : "Aktivitas"}
                        </span>
                      </td>

                      <td>{formatTanggal(waktu)}</td>
                    </tr>
                  );
                })}

                {data.length === 0 && (
                  <tr>
                    <td colSpan="6" className="log-state">
                      {error
                        ? "Data gagal dimuat."
                        : "Belum ada aktivitas yang tercatat pada tanggal ini."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="log-footer">
          <span>
            Menampilkan <strong>{data.length}</strong> aktivitas
          </span>

          {waktuUpdate && (
            <span>
              Diperbarui pukul {waktuUpdate.toLocaleTimeString("id-ID")}
            </span>
          )}
        </div>
      </section>
    </main>
  );
}
