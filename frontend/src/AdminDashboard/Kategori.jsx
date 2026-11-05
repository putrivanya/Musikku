
import { useEffect, useState } from "react";
import "./Kategori.css";
import { API_BASE_URL } from "../api.js";

const API_URL = `${API_BASE_URL}/kategori`;

const initialForm = { nama_kategori: "", deskripsi: "" };

export default function Kategori() {
  const [data, setData] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Gagal mengambil kategori.");
      }

      setData(Array.isArray(result) ? result : result.data || []);
    } catch (err) {
      setError(err.message || "Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(initialForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm({
      nama_kategori: item.nama_kategori || "",
      deskripsi: item.deskripsi || "",
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function handleChange(event) {
    setForm((old) => ({
      ...old,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Token login tidak ditemukan. Silakan login ulang.");
      }

      const response = await fetch(
        editingId ? `${API_URL}/${editingId}` : API_URL,
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Gagal menyimpan kategori.");
      }

      setShowForm(false);
      setForm(initialForm);
      setEditingId(null);
      setSuccess(result.message || "Kategori berhasil disimpan.");
      await loadData();
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Hapus kategori "${item.nama_kategori}"?`)) return;

    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/${item.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Gagal menghapus kategori.");
      }

      setSuccess(result.message || "Kategori berhasil dihapus.");
      await loadData();
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    }
  }

  const filtered = data.filter((item) =>
    `${item.nama_kategori || ""} ${item.deskripsi || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="kategori-page">
      <header className="kategori-heading">
        <div>
          <span className="kategori-eyebrow">INVENTARIS MUSIKKU</span>
          <h2>CRUD Kategori</h2>
          <p>Kelola kategori untuk mengelompokkan alat musik.</p>
        </div>

        <button className="kategori-primary" onClick={openAdd}>
          + Tambah Kategori
        </button>
      </header>

      {error && <div className="kategori-alert error">{error}</div>}
      {success && <div className="kategori-alert success">{success}</div>}

      {showForm && (
        <section className="kategori-card">
          <div className="kategori-card-heading">
            <h3>{editingId ? "Edit Kategori" : "Tambah Kategori Baru"}</h3>
            <button
              type="button"
              className="kategori-close"
              onClick={() => setShowForm(false)}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="kategori-form-grid">
              <label>
                Nama kategori
                <input
                  name="nama_kategori"
                  value={form.nama_kategori}
                  onChange={handleChange}
                  maxLength={100}
                  placeholder="Contoh: Gitar"
                  required
                />
              </label>

              <label>
                Deskripsi
                <textarea
                  name="deskripsi"
                  value={form.deskripsi}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Keterangan kategori..."
                />
              </label>
            </div>

            <div className="kategori-form-actions">
              <button
                type="button"
                className="kategori-secondary"
                onClick={() => setShowForm(false)}
              >
                Batal
              </button>

              <button className="kategori-primary" disabled={saving}>
                {saving
                  ? "Menyimpan..."
                  : editingId
                    ? "Simpan Perubahan"
                    : "Simpan Kategori"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="kategori-card">
        <div className="kategori-card-heading kategori-table-heading">
          <div>
            <h3>Daftar Kategori</h3>
            <p>Total kategori: {data.length}</p>
          </div>

          <input
            className="kategori-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kategori..."
          />
        </div>

        {loading ? (
          <p className="kategori-state">Memuat kategori...</p>
        ) : (
          <div className="kategori-table-wrap">
            <table className="kategori-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Nama Kategori</th>
                  <th>Deskripsi</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td className="kategori-name">{item.nama_kategori}</td>
                    <td>{item.deskripsi || "—"}</td>
                    <td>
                      <div className="kategori-actions">
                        <button
                          className="kategori-edit"
                          onClick={() => openEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          className="kategori-delete"
                          onClick={() => handleDelete(item)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="4" className="kategori-state">
                      {search
                        ? "Kategori tidak ditemukan."
                        : "Belum ada kategori. Klik Tambah Kategori."}
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
