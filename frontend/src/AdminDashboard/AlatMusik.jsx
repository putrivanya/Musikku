
import { useCallback, useEffect, useMemo, useState } from "react";
import "./AlatMusik.css";
import {
  API_BASE_URL,
  SERVER_BASE_URL,
  getToken,
} from "../api.js";

const SERVER_URL = SERVER_BASE_URL;
const API_URL = `${API_BASE_URL}/alat`;
const KATEGORI_URL = `${API_BASE_URL}/kategori`;
const UPLOAD_URL = `${SERVER_URL}/uploads/alat/`;
const MAX_FOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_FOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const initialForm = {
  kategori_id: "",
  nama_alat: "",
  merk: "",
  stok: "0",
  kondisi: "baik",
  keterangan: "",
};

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  let result;

  if (contentType.includes("application/json")) {
    result = await response.json();
  } else {
    const message = await response.text();
    result = {
      message: message || `Permintaan gagal (${response.status}).`,
    };
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Permintaan gagal (${response.status}).`
    );
  }

  return result;
}

function getRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.alat)) return result.alat;
  if (Array.isArray(result?.kategori)) return result.kategori;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function getId(item) {
  return item?.id ?? item?.id_alat ?? item?.alat_id;
}

function getKategoriId(item) {
  return item?.kategori_id ?? item?.id_kategori ?? item?.kategori?.id ?? "";
}

function getKategoriNama(item) {
  return (
    item?.nama_kategori ||
    item?.kategori?.nama_kategori ||
    item?.kategori?.nama ||
    item?.nama_kategori_alat ||
    ""
  );
}

function getFotoUrl(item) {
  const raw =
    item?.foto ??
    item?.gambar ??
    item?.foto_alat ??
    item?.foto_url ??
    item?.image ??
    item?.image_url ??
    "";

  if (typeof raw !== "string" || !raw.trim()) return "";

  const value = raw.trim().replace(/\\/g, "/");

  if (/^https?:\/\//i.test(value)) return value;

  if (/^\/?uploads\//i.test(value)) {
    return `${SERVER_URL}/${value.replace(/^\/+/, "")}`;
  }

  if (/^\/?alat\//i.test(value)) {
    return `${SERVER_URL}/uploads/${value.replace(/^\/+/, "")}`;
  }

  if (value.startsWith("/")) {
    return `${SERVER_URL}${value}`;
  }

  return `${UPLOAD_URL}${encodeURIComponent(value)}`;
}

function getNamaKategori(item) {
  return (
    getKategoriNama(item) ||
    item?.kategori_id ||
    item?.id_kategori ||
    "—"
  );
}

export default function AlatMusik() {
  const [data, setData] = useState([]);
  const [kategori, setKategori] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [brokenPhotos, setBrokenPhotos] = useState({});

  const token = getToken();

  const headers = useMemo(() => {
    const result = { Accept: "application/json" };

    if (token) {
      result.Authorization = `Bearer ${token}`;
    }

    return result;
  }, [token]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        headers,
      });

      const result = await readResponse(response);
      const rows = getRows(result);

      setData(rows);
      setBrokenPhotos({});
    } catch (err) {
      console.error("Gagal mengambil data alat musik:", err);
      setError(err.message || "Tidak dapat terhubung ke backend.");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const loadKategori = useCallback(async () => {
    try {
      const response = await fetch(KATEGORI_URL, {
        headers,
      });

      const result = await readResponse(response);
      setKategori(getRows(result));
    } catch (err) {
      console.error("Gagal mengambil kategori:", err);
      setKategori([]);
    }
  }, [headers]);

  useEffect(() => {
    loadData();
    loadKategori();
  }, [loadData, loadKategori]);

  // Bersihkan URL preview file sementara saat komponen ditutup.
  useEffect(() => {
    return () => {
      if (preview.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  function clearPreview() {
    setPreview((oldPreview) => {
      if (oldPreview.startsWith("blob:")) {
        URL.revokeObjectURL(oldPreview);
      }

      return "";
    });
  }

  function resetForm() {
    clearPreview();
    setForm(initialForm);
    setFoto(null);
    setEditingId(null);
    setShowForm(false);
  }

  function openAdd() {
    clearPreview();
    setForm(initialForm);
    setFoto(null);
    setEditingId(null);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(item) {
    clearPreview();

    setEditingId(getId(item));

    setForm({
      kategori_id: String(getKategoriId(item)),
      nama_alat: item.nama_alat || "",
      merk: item.merk || item.merek || "",
      stok: String(item.stok ?? 0),
      kondisi: item.kondisi || "baik",
      keterangan: item.keterangan || "",
    });

    setFoto(null);
    setPreview(getFotoUrl(item));
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((old) => ({
      ...old,
      [name]: value,
    }));
  }

  function handleFotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!ALLOWED_FOTO_TYPES.includes(file.type)) {
      setError("Foto harus berupa JPG, PNG, atau WebP.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FOTO_SIZE) {
      setError("Ukuran foto maksimal 5 MB.");
      event.target.value = "";
      return;
    }

    clearPreview();
    setError("");
    setFoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!getToken()) {
      setError("Token login tidak ditemukan. Silakan login ulang.");
      return;
    }

    if (!form.kategori_id) {
      setError("Silakan pilih kategori alat musik.");
      return;
    }

    if (!form.nama_alat.trim()) {
      setError("Nama alat musik wajib diisi.");
      return;
    }

    const stok = Number(form.stok);

    if (!Number.isInteger(stok) || stok < 0) {
      setError("Stok harus berupa bilangan bulat dan tidak boleh negatif.");
      return;
    }

    if (!editingId && !foto) {
      setError("Silakan pilih foto alat musik.");
      return;
    }

    setSaving(true);

    try {
      const payload = new FormData();

      payload.append("kategori_id", form.kategori_id);
      payload.append("nama_alat", form.nama_alat.trim());
      payload.append("merk", form.merk.trim());
      payload.append("stok", String(stok));
      payload.append("kondisi", form.kondisi);
      payload.append("keterangan", form.keterangan.trim());

      // Nama field ini harus cocok dengan upload.single("foto")
      // atau konfigurasi field foto yang digunakan backend.
      if (foto) {
        payload.append("foto", foto);
      }

      const id = encodeURIComponent(String(editingId));

      const response = await fetch(
        editingId ? `${API_URL}/${id}` : API_URL,
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: "application/json",
          },
          body: payload,
        }
      );

      await readResponse(response);

      resetForm();

      setSuccess(
        editingId
          ? "Data alat musik berhasil diperbarui."
          : "Alat musik berhasil ditambahkan."
      );

      await loadData();
    } catch (err) {
      console.error("Gagal menyimpan alat musik:", err);
      setError(err.message || "Terjadi kesalahan saat menyimpan data.");
    } finally {
      setSaving(false);
    }
  }

  function mintaHapus(item) {
    setError("");
    setSuccess("");
    setDeleteTarget(item);
  }

  async function konfirmasiHapus() {
    if (!deleteTarget || deleting) return;

    const id = getId(deleteTarget);

    if (id == null) {
      setError("ID alat musik tidak ditemukan.");
      setDeleteTarget(null);
      return;
    }

    if (!getToken()) {
      setError("Token login tidak ditemukan. Silakan login ulang.");
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/${encodeURIComponent(String(id))}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: "application/json",
          },
        }
      );

      const result = await readResponse(response);

      setSuccess(result.message || "Data alat musik berhasil dihapus.");
      setDeleteTarget(null);

      await loadData();
    } catch (err) {
      console.error("Gagal menghapus alat musik:", err);
      setError(err.message || "Terjadi kesalahan saat menghapus data.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const filteredData = data.filter((item) => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return true;

    return [
      item.nama_alat,
      item.merk,
      item.merek,
      getNamaKategori(item),
      item.kondisi,
      item.keterangan,
    ]
      .filter((value) => value !== null && value !== undefined)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });

  const totalStok = data.reduce(
    (total, item) => total + (Number(item.stok) || 0),
    0
  );

  return (
    <main className="alat-page">
      <section className="alat-intro">
        <div>
          <span className="alat-eyebrow">INVENTARIS MUSIKKU</span>
          <h2>Kelola Alat Musik</h2>
          <p>Kelola inventaris, kategori, stok, kondisi, dan foto alat musik.</p>
        </div>

        <button
          type="button"
          className="alat-btn-primary"
          onClick={openAdd}
        >
          ＋ Tambah Alat
        </button>
      </section>

      {error && (
        <div className="alat-alert error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Tutup pesan">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="alat-alert success" role="status">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")} aria-label="Tutup pesan">
            ×
          </button>
        </div>
      )}

      <section className="alat-summary">
        <div className="alat-summary-icon">♫</div>
        <div>
          <p>Total jenis alat musik</p>
          <h3>{data.length}</h3>
        </div>
        <div className="alat-summary-divider" />
        <div>
          <p>Total stok alat</p>
          <h3>{totalStok}</h3>
        </div>
        <div className="alat-summary-note">Data inventaris dari API</div>
      </section>

      {showForm && (
        <section className="alat-panel">
          <div className="alat-panel-heading">
            <div>
              <span className="alat-eyebrow">FORMULIR INVENTARIS</span>
              <h3>{editingId ? "Edit Alat Musik" : "Tambah Alat Musik"}</h3>
            </div>

            <button
              type="button"
              className="alat-close"
              onClick={resetForm}
              disabled={saving}
              aria-label="Tutup formulir"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="alat-form-grid">
              <label>
                Kategori alat musik
                <select
                  name="kategori_id"
                  value={form.kategori_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Pilih kategori --</option>
                  {kategori.map((item, index) => {
                    const id =
                      item.id ??
                      item.kategori_id ??
                      item.id_kategori;

                    const namaKategori =
                      item.nama_kategori ??
                      item.nama ??
                      item.kategori ??
                      `Kategori ${id}`;

                    return (
                      <option key={id ?? index} value={id}>
                        {namaKategori}
                      </option>
                    );
                  })}
                </select>

                {kategori.length === 0 && (
                  <small className="alat-field-note">
                    Kategori belum berhasil dimuat. Periksa endpoint /api/kategori.
                  </small>
                )}
              </label>

              <label>
                Nama alat musik
                <input
                  name="nama_alat"
                  value={form.nama_alat}
                  onChange={handleChange}
                  required
                  maxLength={150}
                  placeholder="Contoh: Gitar Akustik"
                />
              </label>

              <label>
                Merek
                <input
                  name="merk"
                  value={form.merk}
                  onChange={handleChange}
                  maxLength={100}
                  placeholder="Contoh: Yamaha"
                />
              </label>

              <label>
                Stok
                <input
                  type="number"
                  name="stok"
                  value={form.stok}
                  onChange={handleChange}
                  min="0"
                  step="1"
                  required
                />
              </label>

              <label>
                Kondisi alat
                <select
                  name="kondisi"
                  value={form.kondisi}
                  onChange={handleChange}
                  required
                >
                  <option value="baik">Baik</option>
                  <option value="rusak ringan">Rusak ringan</option>
                  <option value="rusak berat">Rusak berat</option>
                </select>
              </label>

              <label className="alat-full">
                Foto alat musik
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFotoChange}
                  required={!editingId}
                />
                <small>
                  Format JPG, PNG, WEBP, atau GIF. Maksimal 5 MB.
                  {editingId ? " Kosongkan jika tidak ingin mengganti foto." : ""}
                </small>

                {preview && (
                  <div className="alat-foto-preview">
                    <img
                      src={preview}
                      alt="Preview alat musik"
                      onError={() =>
                        setError(
                          "Foto tidak dapat dimuat. Periksa lokasi file foto di backend."
                        )
                      }
                    />
                    <div className="alat-preview-info">
                      <span>{foto ? foto.name : "Foto saat ini"}</span>
                      {foto && (
                        <button
                          type="button"
                          className="alat-btn-light"
                          onClick={() => {
                            clearPreview();
                            setFoto(null);
                          }}
                        >
                          Batalkan foto baru
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </label>

              <label className="alat-full">
                Keterangan
                <textarea
                  name="keterangan"
                  value={form.keterangan}
                  onChange={handleChange}
                  rows="3"
                  maxLength={1000}
                  placeholder="Keterangan tambahan..."
                />
              </label>
            </div>

            <div className="alat-form-actions">
              <button
                type="button"
                className="alat-btn-light"
                onClick={resetForm}
                disabled={saving}
              >
                Batal
              </button>

              <button
                type="submit"
                className="alat-btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Menyimpan..."
                  : editingId
                    ? "Simpan Perubahan"
                    : "Simpan Alat"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="alat-panel">
        <div className="alat-panel-heading alat-table-heading">
          <div>
            <h3>Daftar Alat Musik</h3>
            <p>Data inventaris yang tersimpan di database.</p>
          </div>

          <div className="alat-search-group">
            <input
              className="alat-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari alat, merek, kategori..."
              aria-label="Cari alat musik"
            />

            <button
              type="button"
              className="alat-btn-light"
              onClick={loadData}
              disabled={loading}
            >
              {loading ? "Memuat..." : "↻ Muat Ulang"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="alat-state">Memuat data inventaris...</div>
        ) : (
          <div className="alat-table-wrap">
            <table className="alat-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Foto</th>
                  <th>Nama Alat</th>
                  <th>Merek</th>
                  <th>Kategori</th>
                  <th>Stok</th>
                  <th>Kondisi</th>
                  <th>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filteredData.map((item, index) => {
                  const id = getId(item);
                  const fotoUrl = getFotoUrl(item);
                  const photoKey = String(id ?? index);

                  return (
                    <tr key={photoKey}>
                      <td>{index + 1}</td>

                      <td>
                        {fotoUrl && !brokenPhotos[photoKey] ? (
                          <img
                            className="alat-table-foto"
                            src={fotoUrl}
                            alt={item.nama_alat || "Foto alat musik"}
                            loading="lazy"
                            onError={() => {
                              console.error("Foto gagal dimuat:", fotoUrl);

                              setBrokenPhotos((old) => ({
                                ...old,
                                [photoKey]: true,
                              }));
                            }}
                          />
                        ) : (
                          <span className="alat-no-foto">
                            {fotoUrl ? "Foto gagal dimuat" : "Belum ada foto"}
                          </span>
                        )}
                      </td>

                      <td className="alat-name">{item.nama_alat || "—"}</td>
                      <td>{item.merk || item.merek || "—"}</td>
                      <td>{getNamaKategori(item)}</td>
                      <td>
                        <span className="alat-stock">{item.stok ?? 0}</span>
                      </td>
                      <td>
                        <span
                          className={`alat-condition ${
                            String(item.kondisi || "").toLowerCase() === "baik"
                              ? "condition-good"
                              : "condition-damaged"
                          }`}
                        >
                          {item.kondisi || "—"}
                        </span>
                      </td>
                      <td>
                        <div className="alat-actions">
                          <button
                            type="button"
                            className="alat-btn-edit"
                            onClick={() => openEdit(item)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="alat-btn-delete"
                            onClick={() => mintaHapus(item)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan="8" className="alat-empty">
                      {search
                        ? "Data yang dicari tidak ditemukan."
                        : "Belum ada alat musik."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="alat-footer">
          Menampilkan <strong>{filteredData.length}</strong> dari{" "}
          <strong>{data.length}</strong> alat musik
        </div>
      </section>

      {/* POPUP KONFIRMASI HAPUS */}
      {deleteTarget && (
        <div
          className="alat-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteTarget(null);
            }
          }}
        >
          <section
            className="alat-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alat-delete-title"
            aria-describedby="alat-delete-description"
          >
            <div className="alat-delete-icon">!</div>
            <span className="alat-eyebrow">KONFIRMASI TINDAKAN</span>
            <h3 id="alat-delete-title">Hapus alat musik?</h3>
            <p id="alat-delete-description">
              Data <strong>{deleteTarget.nama_alat}</strong> akan dihapus.
              Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="alat-modal-actions">
              <button
                type="button"
                className="alat-btn-light"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Batal
              </button>

              <button
                type="button"
                className="alat-btn-delete"
                onClick={konfirmasiHapus}
                disabled={deleting}
              >
                {deleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
