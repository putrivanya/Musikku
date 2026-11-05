
import { useCallback, useEffect, useState } from "react";
import "./User.css";
import { API_BASE_URL, notifySessionExpired } from "../api.js";

const API = `${API_BASE_URL}/users`;

const emptyForm = {
  nama: "",
  username: "",
  email: "",
  password: "",
  role_id: "3",
};

function getRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.users)) return result.users;
  return [];
}

async function request(url, options = {}) {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
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
    throw new Error(result.message || `Permintaan gagal (${response.status}).`);
  }

  return result;
}

function getRoleName(role) {
  const value = String(role ?? "").toLowerCase();

  if (value === "1" || value === "admin") return "Admin";
  if (value === "2" || value === "petugas") return "Petugas";
  if (value === "3" || value === "peminjam") return "Peminjam";

  return "Tidak diketahui";
}

export default function User() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await request(API);
      setUsers(getRows(result));
    } catch (err) {
      setError(err.message || "Gagal mengambil data pengguna.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function openEditForm(user) {
    setEditingId(user.id);
    setForm({
      nama: user.nama || "",
      username: user.username || "",
      email: user.email || "",
      password: "",
      role_id: String(user.role_id ?? "3"),
    });
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.password && form.password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        nama: form.nama.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        role_id: Number(form.role_id),
      };

      if (form.password.trim()) {
        payload.password = form.password;
      }

      if (!editingId && !payload.password) {
        throw new Error("Password wajib diisi untuk akun baru.");
      }

      const result = await request(
        editingId ? `${API}/${editingId}` : API,
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      closeForm();
      setMessage(
        result.message ||
          (editingId
            ? "Data pengguna berhasil diperbarui."
            : "Pengguna berhasil ditambahkan.")
      );

      await loadUsers();
    } catch (err) {
      setError(err.message || "Gagal menyimpan pengguna.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user) {
    if (
      !window.confirm(
        `Yakin ingin menghapus akun "${user.nama}"?`
      )
    ) {
      return;
    }

    setDeletingId(user.id);
    setError("");
    setMessage("");

    try {
      const result = await request(`${API}/${user.id}`, {
        method: "DELETE",
      });

      setMessage(result.message || "Pengguna berhasil dihapus.");
      await loadUsers();
    } catch (err) {
      setError(err.message || "Gagal menghapus pengguna.");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredUsers = users.filter((user) => {
    const keyword = search.trim().toLowerCase();

    return [
      user.nama,
      user.username,
      user.email,
      getRoleName(user.role_id ?? user.role),
    ]
      .filter(Boolean)
      .some((value) =>
        String(value).toLowerCase().includes(keyword)
      );
  });

  return (
    <main className="user-page">
      <section className="user-heading">
        <div>
          <p className="user-breadcrumb">MusikKu / Administrasi</p>
          <h1>CRUD User</h1>
          <p>Kelola akun admin, petugas, dan peminjam.</p>
        </div>

        <button
          type="button"
          className="user-primary-btn"
          onClick={openAddForm}
        >
          + Tambah User
        </button>
      </section>

      {message && (
        <div className="user-alert success" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="user-alert error" role="alert">
          {error}
        </div>
      )}

      {showForm && (
        <section className="user-card">
          <div className="user-card-title">
            <h2>{editingId ? "Edit User" : "Tambah User Baru"}</h2>

            <button
              type="button"
              className="user-close-btn"
              onClick={closeForm}
              disabled={saving}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="user-form-grid">
              <label>
                Nama lengkap
                <input
                  name="nama"
                  value={form.nama}
                  onChange={handleChange}
                  required
                  maxLength={100}
                  placeholder="Masukkan nama"
                />
              </label>

              <label>
                Username
                <input
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  required
                  maxLength={50}
                  placeholder="Masukkan username"
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  maxLength={150}
                  placeholder="nama@email.com"
                />
              </label>

              <label>
                {editingId ? "Password baru (opsional)" : "Password"}
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required={!editingId}
                  minLength={8}
                  autoComplete="new-password"
                  placeholder={
                    editingId
                      ? "Kosongkan jika tidak diubah"
                      : "Minimal 8 karakter"
                  }
                />
              </label>

              <label>
                Role pengguna
                <select
                  name="role_id"
                  value={form.role_id}
                  onChange={handleChange}
                  required
                >
                  <option value="1">Admin</option>
                  <option value="2">Petugas</option>
                  <option value="3">Peminjam</option>
                </select>
              </label>
            </div>

            <div className="user-form-actions">
              <button
                type="button"
                className="user-secondary-btn"
                onClick={closeForm}
                disabled={saving}
              >
                Batal
              </button>

              <button
                type="submit"
                className="user-primary-btn"
                disabled={saving}
              >
                {saving
                  ? "Menyimpan..."
                  : editingId
                    ? "Simpan Perubahan"
                    : "Simpan User"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="user-card">
        <div className="user-table-heading">
          <div>
            <h2>Data Pengguna</h2>
            <p>Data akun yang tersimpan di database.</p>
          </div>

          <input
            className="user-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama, username, role..."
            aria-label="Cari pengguna"
          />
        </div>

        {loading ? (
          <div className="user-state">Memuat data pengguna...</div>
        ) : (
          <div className="user-table-wrapper">
            <table className="user-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Nama</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr key={user.id}>
                    <td>{index + 1}</td>
                    <td className="user-name">{user.nama}</td>
                    <td>{user.username}</td>
                    <td>{user.email || "—"}</td>
                    <td>
                      <span className="user-role">
                        {getRoleName(user.role_id ?? user.role)}
                      </span>
                    </td>
                    <td>
                      <div className="user-row-actions">
                        <button
                          type="button"
                          className="user-edit-btn"
                          onClick={() => openEditForm(user)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="user-delete-btn"
                          onClick={() => handleDelete(user)}
                          disabled={deletingId === user.id}
                        >
                          {deletingId === user.id
                            ? "Menghapus..."
                            : "Hapus"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="user-empty">
                      {search
                        ? "Tidak ada pengguna yang cocok."
                        : "Belum ada data pengguna."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="user-table-footer">
          Total pengguna: <strong>{filteredUsers.length}</strong>
        </div>
      </section>
    </main>
  );
}
