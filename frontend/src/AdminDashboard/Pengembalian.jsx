
import { useCallback, useEffect, useState } from "react";
import "./Pengembalian.css";
import { API_BASE_URL, notifySessionExpired } from "../api.js";

const API = `${API_BASE_URL}/pengembalian`;

const formAwal = {
  peminjaman_id: "",
  tanggal_kembali: "",
  denda: "0",
  kondisi_kembali: "baik",
  catatan: "",
  status: "belum kembali",
};

function getRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

async function request(url, options = {}) {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const text = await response.text();
  let result = {};

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = { message: text || "Respons server tidak valid." };
  }

  if (!response.ok) {
    if (response.status === 401) notifySessionExpired();

    throw new Error(
      result.message || `Permintaan gagal (${response.status}).`
    );
  }

  return result;
}

function formatRupiah(value) {
  return Number(value || 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

export default function Pengembalian() {
  const [data, setData] = useState([]);
  const [peminjaman, setPeminjaman] = useState([]);

  const [form, setForm] = useState(formAwal);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [returnResult, loanResult] = await Promise.all([
        request(API),
        request(`${API_BASE_URL}/peminjaman`),
      ]);

      setData(getRows(returnResult));
      setPeminjaman(
        getRows(loanResult).filter(
          (item) => String(item.status).toLowerCase() === "dipinjam"
        )
      );
    } catch (err) {
      setError(err.message || "Gagal mengambil data pengembalian.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function tutupForm() {
    setShowForm(false);
    setEditId(null);
    setForm(formAwal);
  }

  function bukaTambah() {
    setEditId(null);
    setForm({
      ...formAwal,
      tanggal_kembali: new Date().toLocaleDateString("en-CA"),
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function bukaEdit(item) {
    setEditId(item.id);
    setForm({
      peminjaman_id: String(item.peminjaman_id),
      tanggal_kembali: String(item.tanggal_kembali || "").slice(0, 10),
      denda: String(item.denda ?? 0),
      kondisi_kembali: item.kondisi_kembali || "baik",
      catatan: item.catatan || "",
      status: item.status || "belum kembali",
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function ubahForm(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function simpan(event) {
    event.preventDefault();

    if (!form.tanggal_kembali) {
      setError("Tanggal kembali wajib diisi.");
      return;
    }

    if (
      !Number.isFinite(Number(form.denda)) ||
      Number(form.denda) < 0
    ) {
      setError("Denda harus berupa angka nol atau lebih.");
      return;
    }

    if (!editId && !form.peminjaman_id) {
      setError("Pilih transaksi peminjaman terlebih dahulu.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let result;

      if (editId) {
        result = await request(`${API}/${editId}`, {
          method: "PUT",
          body: JSON.stringify({
            tanggal_kembali: form.tanggal_kembali,
            denda: Number(form.denda),
            kondisi_kembali: form.kondisi_kembali,
            catatan: form.catatan,
            status: form.status,
          }),
        });
      } else {
        result = await request(API, {
          method: "POST",
          body: JSON.stringify({
            peminjaman_id: Number(form.peminjaman_id),
            tanggal_kembali: form.tanggal_kembali,
            kondisi_kembali: form.kondisi_kembali,
            catatan: form.catatan,
          }),
        });
      }

      tutupForm();
      setSuccess(
        result.message ||
          (editId
            ? "Data pengembalian berhasil diperbarui."
            : "Pengajuan pengembalian berhasil dibuat.")
      );

      await loadData();
    } catch (err) {
      setError(err.message || "Gagal menyimpan data pengembalian.");
    } finally {
      setSaving(false);
    }
  }

  async function hapus(item) {
    if (item.status !== "belum kembali") {
      setError(
        "Pengembalian yang sudah dikonfirmasi tidak dapat dihapus."
      );
      return;
    }

    if (!window.confirm(`Hapus pengembalian #${item.id}?`)) {
      return;
    }

    setDeletingId(item.id);
    setError("");
    setSuccess("");

    try {
      const result = await request(`${API}/${item.id}`, {
        method: "DELETE",
      });

      setSuccess(result.message || "Pengembalian berhasil dihapus.");
      await loadData();
    } catch (err) {
      setError(err.message || "Gagal menghapus pengembalian.");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = data.filter((item) =>
    [
      item.id,
      item.peminjaman_id,
      item.nama_peminjam,
      item.nama_alat,
      item.kondisi_kembali,
      item.status,
      item.catatan,
    ]
      .filter((value) => value != null)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="peng-page">
      <header className="peng-heading">
        <div>
          <span className="peng-eyebrow">TRANSAKSI MUSIKKU</span>
          <h2>Data Pengembalian</h2>
          <p>Kelola pengajuan dan catatan pengembalian alat musik.</p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="peng-secondary"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Memuat..." : "↻ Muat Ulang"}
          </button>

          <button
            type="button"
            className="peng-primary"
            onClick={bukaTambah}
          >
            + Tambah Pengembalian
          </button>
        </div>
      </header>

      {error && (
        <div className="peng-alert error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="peng-alert success" role="status">
          {success}
        </div>
      )}

      {showForm && (
        <section className="peng-card">
          <h3>
            {editId
              ? `Edit Pengembalian #${editId}`
              : "Tambah Pengembalian"}
          </h3>

          <form onSubmit={simpan}>
            <div className="peng-form-grid">
              {!editId && (
                <label>
                  Transaksi Peminjaman
                  <select
                    name="peminjaman_id"
                    value={form.peminjaman_id}
                    onChange={ubahForm}
                    required
                  >
                    <option value="">Pilih transaksi</option>
                    {peminjaman.map((item) => (
                      <option key={item.id} value={item.id}>
                        #{item.id} - {item.nama_peminjam || "Peminjam"} - {item.nama_alat || "Alat"}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                Tanggal Kembali
                <input
                  type="date"
                  name="tanggal_kembali"
                  value={form.tanggal_kembali}
                  onChange={ubahForm}
                  required
                />
              </label>

              <label>
                Kondisi Alat
                <select
                  name="kondisi_kembali"
                  value={form.kondisi_kembali}
                  onChange={ubahForm}
                  required
                >
                  <option value="baik">Baik</option>
                  <option value="rusak ringan">Rusak ringan</option>
                  <option value="rusak berat">Rusak berat</option>
                </select>
              </label>

              {editId && (
                <label>
                  Denda (Rp)
                  <input
                    type="number"
                    name="denda"
                    min="0"
                    step="1"
                    value={form.denda}
                    onChange={ubahForm}
                    required
                  />
                </label>
              )}

              {editId && (
                <label>
                  Status Pengembalian
                  <select
                    name="status"
                    value={form.status}
                    onChange={ubahForm}
                    required
                    disabled={form.status === "dikembalikan"}
                  >
                    <option value="belum kembali">Belum kembali</option>
                    <option value="dikembalikan">Dikembalikan</option>
                  </select>
                </label>
              )}

              <label className="peng-full">
                Catatan
                <textarea
                  name="catatan"
                  rows={3}
                  value={form.catatan}
                  onChange={ubahForm}
                  maxLength={1000}
                  placeholder="Catatan kondisi alat..."
                />
              </label>
            </div>

            <div className="peng-form-actions">
              <button
                type="button"
                className="peng-secondary"
                onClick={tutupForm}
                disabled={saving}
              >
                Batal
              </button>

              <button
                type="submit"
                className="peng-primary"
                disabled={saving}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="peng-card">
        <div className="peng-table-heading">
          <div>
            <h3>Daftar Pengembalian</h3>
            <p>Total: {data.length} catatan</p>
          </div>

          <input
            className="peng-search"
            type="search"
            placeholder="Cari peminjam, kondisi, atau status..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <p className="peng-state">Memuat data pengembalian...</p>
        ) : (
          <div className="peng-table-wrap">
            <table className="peng-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Peminjam</th>
                  <th>Tanggal Kembali</th>
                  <th>Denda</th>
                  <th>Kondisi</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.id}</td>
                    <td>
                      {item.nama_peminjam ||
                        `Peminjaman #${item.peminjaman_id}`}
                    </td>
                    <td>
                      {String(item.tanggal_kembali || "").slice(0, 10) || "—"}
                    </td>
                    <td>{formatRupiah(item.denda)}</td>
                    <td>{item.kondisi_kembali || "—"}</td>
                    <td>
                      <span className="peng-status">
                        {item.status || "—"}
                      </span>
                    </td>
                    <td>
                      <div className="peng-actions">
                        <button
                          type="button"
                          className="peng-edit"
                          onClick={() => bukaEdit(item)}
                        >
                          Edit
                        </button>

                        {item.status === "belum kembali" && (
                          <button
                            type="button"
                            className="peng-delete"
                            onClick={() => hapus(item)}
                            disabled={deletingId === item.id}
                          >
                            {deletingId === item.id ? "Menghapus..." : "Hapus"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="7" className="peng-state">
                      {search
                        ? "Data pengembalian tidak ditemukan."
                        : "Belum ada catatan pengembalian."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
