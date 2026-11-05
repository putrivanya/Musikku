
import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL, notifySessionExpired } from "../api.js";
import "./Peminjaman.css";

const API = API_BASE_URL;

const STATUS = {
  menunggu: ["Menunggu", "menunggu"],
  disetujui: ["Disetujui", "disetujui"],
  ditolak: ["Ditolak", "ditolak"],
  dibatalkan: ["Dibatalkan", "dibatalkan"],
  dipinjam: ["Dipinjam", "dipinjam"],
  selesai: ["Selesai", "selesai"],
};

function getRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.users)) return result.users;
  if (Array.isArray(result?.alat)) return result.alat;
  if (Array.isArray(result?.peminjaman)) return result.peminjaman;
  return [];
}

async function parseResponse(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text || "Respons server tidak valid." };
  }
}

function tanggal(value) {
  if (!value) return "—";

  const dateString = String(value).split("T")[0];
  const parts = dateString.split("-");

  if (parts.length !== 3) return dateString;

  const date = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function hariIni() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseItems(item) {
  let items = item?.items;

  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }

  if (Array.isArray(items) && items.length > 0) {
    return items.map((detail) => ({
      alat_id: String(detail.alat_id ?? detail.id_alat ?? ""),
      jumlah: Number(detail.jumlah ?? 1),
    }));
  }

  return [
    {
      alat_id: String(item?.alat_id ?? item?.id_alat ?? ""),
      jumlah: Number(item?.jumlah ?? 1),
    },
  ];
}

function formAwal() {
  return {
    user_id: "",
    alat_id: "",
    jumlah: "1",
    tanggal_pinjam: hariIni(),
    tanggal_rencana_kembali: "",
    jaminan: "",
    catatan: "",
  };
}

export default function Peminjaman() {
  const [data, setData] = useState([]);
  const [users, setUsers] = useState([]);
  const [alat, setAlat] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prosesId, setProsesId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(formAwal);

  const [pesan, setPesan] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const request = useCallback(async (path, options = {}) => {
    const authToken = localStorage.getItem("token");

    if (!authToken) {
      throw new Error(
        "Token login tidak ditemukan. Silakan login kembali."
      );
    }

    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        Authorization: `Bearer ${authToken}`,
        ...options.headers,
      },
    });

    const result = await parseResponse(response);

    if (!response.ok) {
      if (response.status === 401) {
        notifySessionExpired();
      }

      throw new Error(
        result.message || `Permintaan gagal (${response.status}).`
      );
    }

    return result;
  }, []);

  const ambilData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await request("/peminjaman");
      setData(getRows(result));
    } catch (err) {
      setError(err.message || "Gagal memuat data peminjaman.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  const ambilReferensi = useCallback(async () => {
    try {
      const [userResult, alatResult] = await Promise.all([
        request("/users"),
        request("/alat"),
      ]);

      const daftarUser = getRows(userResult);
      const daftarAlat = getRows(alatResult);

      setUsers(
        daftarUser.filter((user) => {
          const role = String(
            user.role || user.nama_role || ""
          ).toLowerCase();

          return (
            Number(user.role_id) === 3 ||
            Number(user.id_role) === 3 ||
            role === "peminjam"
          );
        })
      );

      setAlat(daftarAlat);
    } catch (err) {
      setError(
        `Gagal mengambil daftar pengguna atau alat: ${err.message}`
      );
    }
  }, [request]);

  useEffect(() => {
    ambilData();
    ambilReferensi();
  }, [ambilData, ambilReferensi]);

  function bukaTambah() {
    setEditingId(null);
    setForm(formAwal());
    setError("");
    setPesan("");
    setShowForm(true);
  }

  function bukaEdit(item) {
    const items = parseItems(item);

    setEditingId(item.id);

    setForm({
      user_id: String(item.user_id || ""),
      alat_id: items[0]?.alat_id || "",
      jumlah: String(items[0]?.jumlah || 1),
      tanggal_pinjam: String(
        item.tanggal_pinjam || ""
      ).slice(0, 10),
      tanggal_rencana_kembali: String(
        item.tanggal_rencana_kembali || ""
      ).slice(0, 10),
      jaminan: item.jaminan || "",
      catatan: item.catatan || "",
    });

    setError("");
    setPesan("");
    setShowForm(true);
  }

  function tutupForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(formAwal());
  }

  function ubahForm(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function simpan(event) {
    event.preventDefault();

    setError("");
    setPesan("");

    if (!form.user_id || !form.alat_id) {
      setError("Pilih peminjam dan alat musik terlebih dahulu.");
      return;
    }

    const jumlah = Number(form.jumlah);

    if (!Number.isInteger(jumlah) || jumlah < 1) {
      setError("Jumlah alat minimal 1.");
      return;
    }

    if (!form.tanggal_pinjam) {
      setError("Tanggal peminjaman wajib diisi.");
      return;
    }

    if (!form.tanggal_rencana_kembali) {
      setError("Tanggal rencana pengembalian wajib diisi.");
      return;
    }

    if (form.tanggal_rencana_kembali < form.tanggal_pinjam) {
      setError(
        "Tanggal pengembalian tidak boleh sebelum tanggal peminjaman."
      );
      return;
    }

    if (!editingId && form.tanggal_pinjam < hariIni()) {
      setError("Tanggal peminjaman tidak boleh sebelum hari ini.");
      return;
    }

    const alatDipilih = alat.find(
      (item) => Number(item.id) === Number(form.alat_id)
    );

    if (!alatDipilih) {
      setError("Alat musik yang dipilih tidak ditemukan.");
      return;
    }

    if (
      !editingId &&
      jumlah > Number(alatDipilih.stok)
    ) {
      setError(
        `Stok ${alatDipilih.nama_alat} hanya tersedia ${alatDipilih.stok}.`
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        user_id: Number(form.user_id),
        tanggal_pinjam: form.tanggal_pinjam,
        tanggal_rencana_kembali: form.tanggal_rencana_kembali,
        jaminan: form.jaminan.trim(),
        catatan: form.catatan.trim(),
        items: [
          {
            alat_id: Number(form.alat_id),
            jumlah,
          },
        ],
      };

      const result = await request(
        editingId
          ? `/peminjaman/${editingId}`
          : "/peminjaman",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      const berhasilEdit = Boolean(editingId);

      tutupForm();

      setPesan(
        result.message ||
          (berhasilEdit
            ? "Peminjaman berhasil diperbarui."
            : "Peminjaman berhasil ditambahkan.")
      );

      await ambilData();
      await ambilReferensi();
    } catch (err) {
      setError(
        err.message || "Gagal menyimpan peminjaman."
      );
    } finally {
      setSaving(false);
    }
  }

  async function aksi(item, path, method = "PATCH", body) {
    setProsesId(item.id);
    setError("");
    setPesan("");

    try {
      const result = await request(path, {
        method,
        ...(body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
      });

      setPesan(result.message || "Aksi berhasil dilakukan.");

      await ambilData();
      await ambilReferensi();
    } catch (err) {
      setError(err.message || "Aksi gagal dilakukan.");
    } finally {
      setProsesId(null);
    }
  }

  async function ubahStatus(item, status) {
    const pertanyaan = {
      disetujui:
        "Setujui peminjaman ini? Pastikan stok alat tersedia.",
      ditolak:
        "Tolak pengajuan peminjaman ini?",
      dipinjam:
        "Pastikan alat sudah diserahkan kepada peminjam.",
    };

    if (!window.confirm(pertanyaan[status])) return;

    if (status === "dipinjam") {
      return aksi(
        item,
        `/peminjaman/${item.id}/pinjamkan`
      );
    }

    return aksi(
      item,
      `/peminjaman/${item.id}/status`,
      "PATCH",
      { status }
    );
  }

  async function batalkan(item) {
    if (
      !window.confirm(
        "Batalkan peminjaman ini? Pastikan pembatalan memang diperlukan."
      )
    ) {
      return;
    }

    return aksi(
      item,
      `/peminjaman/${item.id}/batalkan`
    );
  }

  async function hapus(item) {
    if (
      !["menunggu", "ditolak", "dibatalkan"].includes(
        String(item.status).toLowerCase()
      )
    ) {
      setError(
        "Transaksi tidak dapat dihapus karena sudah diproses."
      );
      return;
    }

    if (!window.confirm(`Hapus peminjaman #${item.id}?`)) {
      return;
    }

    return aksi(
      item,
      `/peminjaman/${item.id}`,
      "DELETE"
    );
  }

  async function konfirmasiPengembalian(item) {
    if (
      !window.confirm(
        "Konfirmasi pengembalian? Pastikan alat sudah diperiksa."
      )
    ) {
      return;
    }

    setProsesId(item.id);
    setError("");
    setPesan("");

    try {
      const result = await request("/pengembalian");
      const daftar = getRows(result);

      const pengembalian = daftar.find(
        (row) =>
          Number(row.peminjaman_id) === Number(item.id) &&
          String(row.status).toLowerCase() === "belum kembali"
      );

      if (!pengembalian) {
        throw new Error(
          "Pengajuan pengembalian belum ditemukan."
        );
      }

      const tanggalKembali = String(
        pengembalian.tanggal_kembali || ""
      ).slice(0, 10);

      const update = await request(
        `/pengembalian/${pengembalian.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            tanggal_kembali:
              tanggalKembali || hariIni(),
            kondisi_kembali:
              pengembalian.kondisi_kembali || "baik",
            catatan: pengembalian.catatan || "",
            status: "dikembalikan",
          }),
        }
      );

      setPesan(
        update.message ||
          "Pengembalian berhasil dikonfirmasi."
      );

      await ambilData();
      await ambilReferensi();
    } catch (err) {
      setError(
        err.message || "Gagal mengonfirmasi pengembalian."
      );
    } finally {
      setProsesId(null);
    }
  }

  function ambilItems(item) {
    let items = item.items;

    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch {
        items = [];
      }
    }

    return Array.isArray(items) ? items : [];
  }

  function namaAlat(item) {
    const items = ambilItems(item);

    if (items.length > 0) {
      return items
        .map((detail) =>
          detail.nama_alat ||
          detail.nama ||
          `Alat #${detail.alat_id || detail.id_alat || "-"}`
        )
        .join(", ");
    }

    return item.nama_alat || "—";
  }

  function jumlahAlat(item) {
    const items = ambilItems(item);

    if (items.length > 0) {
      return items.reduce(
        (total, detail) =>
          total + Number(detail.jumlah || 0),
        0
      );
    }

    return Number(item.jumlah || 1);
  }

  const filtered = data.filter((item) =>
    [
      item.nama_peminjam,
      item.nama,
      item.nama_alat,
      namaAlat(item),
      item.status,
      item.jaminan,
      item.id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="pin-page">
      <div className="pin-heading">
        <div>
          <span className="pin-eyebrow">
            TRANSAKSI PEMINJAMAN
          </span>
          <h2>Data Peminjaman</h2>
          <p>
            Kelola pengajuan, persetujuan, penyerahan,
            dan pengembalian alat musik.
          </p>
        </div>

        <div className="pin-heading-actions">
          <button
            type="button"
            className="pin-secondary"
            onClick={ambilData}
            disabled={loading || prosesId !== null}
          >
            <span>↻</span> Refresh
          </button>

          <button
            type="button"
            className="pin-primary"
            onClick={bukaTambah}
          >
            <span>＋</span> Tambah Peminjaman
          </button>
        </div>
      </div>

      {pesan && (
        <div className="pin-alert success">
          <span>✓</span> {pesan}
        </div>
      )}

      {error && (
        <div className="pin-alert error">
          <span>!</span> {error}
        </div>
      )}

      {showForm && (
        <section className="pin-card pin-form-card">
          <div className="pin-form-heading">
            <div>
              <span className="pin-eyebrow">
                {editingId
                  ? "UBAH TRANSAKSI"
                  : "TRANSAKSI BARU"}
              </span>

              <h3>
                {editingId
                  ? `Edit Peminjaman #${editingId}`
                  : "Tambah Peminjaman"}
              </h3>

              <p>
                Lengkapi informasi peminjaman alat musik.
              </p>
            </div>

            <button
              type="button"
              className="pin-close"
              onClick={tutupForm}
              disabled={saving}
              aria-label="Tutup formulir"
            >
              ×
            </button>
          </div>

          <form onSubmit={simpan}>
            <div className="pin-form-grid">
              <label>
                Peminjam
                <select
                  name="user_id"
                  value={form.user_id}
                  onChange={ubahForm}
                  required
                >
                  <option value="">
                    Pilih peminjam
                  </option>

                  {users.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.nama || user.username}
                      {" "}({user.username})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Alat Musik
                <select
                  name="alat_id"
                  value={form.alat_id}
                  onChange={ubahForm}
                  required
                >
                  <option value="">
                    Pilih alat musik
                  </option>

                  {alat.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.nama_alat} | Stok: {item.stok}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Jumlah
                <input
                  type="number"
                  name="jumlah"
                  min="1"
                  value={form.jumlah}
                  onChange={ubahForm}
                  required
                />
              </label>

              <label>
                Tanggal Pinjam
                <input
                  type="date"
                  name="tanggal_pinjam"
                  min={editingId ? undefined : hariIni()}
                  value={form.tanggal_pinjam}
                  onChange={ubahForm}
                  required
                />
              </label>

              <label>
                Rencana Kembali
                <input
                  type="date"
                  name="tanggal_rencana_kembali"
                  min={form.tanggal_pinjam || undefined}
                  value={form.tanggal_rencana_kembali}
                  onChange={ubahForm}
                  required
                />
                <small>
                  Tidak ada batas maksimal waktu pengembalian.
                </small>
              </label>

              <label>
                Jaminan
                <input
                  type="text"
                  name="jaminan"
                  value={form.jaminan}
                  onChange={ubahForm}
                  maxLength={255}
                  placeholder="Contoh: KTP"
                />
              </label>

              <label className="pin-full">
                Catatan
                <textarea
                  name="catatan"
                  rows="3"
                  value={form.catatan}
                  onChange={ubahForm}
                  maxLength={1000}
                  placeholder="Catatan peminjaman..."
                />
              </label>
            </div>

            <div className="pin-form-actions">
              <button
                type="button"
                className="pin-secondary"
                onClick={tutupForm}
                disabled={saving}
              >
                Batal
              </button>

              <button
                type="submit"
                className="pin-primary"
                disabled={saving}
              >
                {saving
                  ? "Menyimpan..."
                  : "Simpan Peminjaman"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="pin-card pin-list-card">
        <div className="pin-table-heading">
          <div>
            <span className="pin-eyebrow">
              DAFTAR TRANSAKSI
            </span>

            <h3>Riwayat Peminjaman</h3>

            <p>
              Menampilkan {filtered.length} dari {data.length} transaksi.
            </p>
          </div>

          <div className="pin-search-wrap">
            <span>⌕</span>

            <input
              type="search"
              className="pin-search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Cari peminjam atau alat..."
            />
          </div>
        </div>

        <div className="pin-table-wrap">
          <table className="pin-table">
            <thead>
              <tr>
                {[
                  "No",
                  "Peminjam",
                  "Alat Musik",
                  "Jumlah",
                  "Tgl Pinjam",
                  "Tgl Kembali",
                  "Jaminan",
                  "Status",
                  "Aksi",
                ].map((judul) => (
                  <th key={judul}>{judul}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="pin-state">
                    <span className="pin-loader" />
                    <p>Memuat data peminjaman...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="pin-state">
                    <span className="pin-empty-icon">♫</span>
                    <p>Belum ada data peminjaman.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item, index) => {
                  const status = String(
                    item.status || "menunggu"
                  ).toLowerCase();

                  const statusInfo =
                    STATUS[status] || STATUS.menunggu;

                  const sedangDiproses =
                    prosesId === item.id;

                  return (
                    <tr key={item.id}>
                      <td className="pin-number">
                        {index + 1}
                      </td>

                      <td className="pin-borrower">
                        {item.nama_peminjam ||
                          item.nama ||
                          "—"}
                      </td>

                      <td>{namaAlat(item)}</td>

                      <td className="pin-quantity">
                        {jumlahAlat(item)}
                      </td>

                      <td className="pin-date">
                        {tanggal(item.tanggal_pinjam)}
                      </td>

                      <td className="pin-date">
                        {tanggal(
                          item.tanggal_rencana_kembali
                        )}
                      </td>

                      <td>{item.jaminan || "—"}</td>

                      <td>
                        <span
                          className={`pin-status ${statusInfo[1]}`}
                        >
                          {statusInfo[0]}
                        </span>
                      </td>

                      <td className="pin-action-cell">
                        <div className="pin-actions">
                          {status === "menunggu" && (
                            <>
                              <button
                                type="button"
                                className="pin-btn pin-btn-edit"
                                onClick={() =>
                                  bukaEdit(item)
                                }
                                disabled={sedangDiproses}
                              >
                                <span>✎</span> Edit
                              </button>

                              <button
                                type="button"
                                className="pin-btn pin-btn-approve"
                                onClick={() =>
                                  ubahStatus(
                                    item,
                                    "disetujui"
                                  )
                                }
                                disabled={sedangDiproses}
                              >
                                <span>✓</span> Setujui
                              </button>

                              <button
                                type="button"
                                className="pin-btn pin-btn-reject"
                                onClick={() =>
                                  ubahStatus(
                                    item,
                                    "ditolak"
                                  )
                                }
                                disabled={sedangDiproses}
                              >
                                <span>✕</span> Tolak
                              </button>

                              <button
                                type="button"
                                className="pin-btn pin-btn-delete"
                                onClick={() =>
                                  hapus(item)
                                }
                                disabled={sedangDiproses}
                              >
                                <span>⌫</span> Hapus
                              </button>
                            </>
                          )}

                          {status === "disetujui" && (
                            <>
                              <button
                                type="button"
                                className="pin-btn pin-btn-approve"
                                onClick={() =>
                                  ubahStatus(
                                    item,
                                    "dipinjam"
                                  )
                                }
                                disabled={sedangDiproses}
                              >
                                <span>↗</span> Serahkan
                              </button>

                              <button
                                type="button"
                                className="pin-btn pin-btn-cancel"
                                onClick={() =>
                                  batalkan(item)
                                }
                                disabled={sedangDiproses}
                              >
                                <span>↶</span> Batalkan
                              </button>
                            </>
                          )}

                          {status === "dipinjam" && (
                            <button
                              type="button"
                              className="pin-btn pin-btn-return"
                              onClick={() =>
                                konfirmasiPengembalian(item)
                              }
                              disabled={sedangDiproses}
                            >
                              <span>✓</span> Konfirmasi Kembali
                            </button>
                          )}

                          {[
                            "ditolak",
                            "dibatalkan",
                          ].includes(status) && (
                            <button
                              type="button"
                              className="pin-btn pin-btn-delete"
                              onClick={() =>
                                hapus(item)
                              }
                              disabled={sedangDiproses}
                            >
                              <span>⌫</span> Hapus
                            </button>
                          )}

                          {status === "selesai" && (
                            <span className="pin-action-complete">
                              <span>✓</span> Transaksi selesai
                            </span>
                          )}
                        </div>

                        {sedangDiproses && (
                          <small className="pin-processing">
                            Memproses...
                          </small>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
