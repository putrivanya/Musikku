
import { useState } from "react";
import "./Register.css";
import { api, getErrorMessage } from "../api.js";

function Register({ onRegisterSuccess, onBack, onGoLogin }) {
  const [form, setForm] = useState({
    nama: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (
      !form.nama.trim() ||
      !form.username.trim() ||
      !form.email.trim() ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("Semua kolom wajib diisi.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    if (
      !/[A-Za-z]/.test(form.password) ||
      !/[0-9]/.test(form.password)
    ) {
      setError("Password harus memuat huruf dan angka.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/register", {
        nama: form.nama.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      const data = response.data || {};

      setSuccess(
        data.message ||
          "Pendaftaran berhasil! Silakan masuk menggunakan akun kamu."
      );

      if (typeof onRegisterSuccess === "function") {
        onRegisterSuccess(data);
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Tidak dapat menghubungi server. Periksa backend kamu."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="register-page">
      <div className="register-decoration register-decoration-one" />
      <div className="register-decoration register-decoration-two" />

      <button
        type="button"
        className="register-back"
        onClick={onBack}
      >
        <span aria-hidden="true"></span> Kembali ke Beranda
      </button>

      <div className="register-layout">
        <section className="register-intro">
          <a
            href="#beranda"
            className="register-logo"
            onClick={(e) => {
              e.preventDefault();
              onBack?.();
            }}
          >
            Musik<span>Ku.</span>
          </a>

          <p className="register-eyebrow">MULAI PERJALANAN MUSIKMU</p>

          <h1>
            Satu langkah
            <br />
            menuju <span>kreasimu.</span>
          </h1>

          <p className="register-intro-description">
            Buat akun MusikKu untuk menemukan alat musik
            dan mengajukan peminjaman dengan lebih mudah.
            Yuk, mulai berkarya bersama MusikKu!
          </p>

          <div className="register-benefits">
            <div>
              <span>♫</span>
              <p>
                <strong>Pilihan alat musik</strong>
                <small>Temukan alat yang kamu butuhkan.</small>
              </p>
            </div>

            <div>
              <span>✓</span>
              <p>
                <strong>Proses terorganisir</strong>
                <small>Kelola pengajuan peminjamanmu.</small>
              </p>
            </div>
          </div>
        </section>

        <section className="register-card">
          <div className="register-card-heading">
            <div className="register-card-icon">♫</div>
            <p className="register-card-label">GABUNG MUSIKKU</p>
            <h2>Buat akun baru</h2>
            <p>Isi data di bawah untuk mulai mendaftar.</p>
          </div>

          {error && (
            <div className="register-alert" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="register-success" role="status">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="register-field">
              <label htmlFor="register-nama">Nama lengkap</label>
              <input
                id="register-nama"
                type="text"
                name="nama"
                placeholder="Masukkan nama lengkap"
                value={form.nama}
                onChange={handleChange}
                autoComplete="name"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="register-username">Username</label>
              <input
                id="register-username"
                type="text"
                name="username"
                placeholder="Buat username"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="register-email">Email</label>
              <input
                id="register-email"
                type="email"
                name="email"
                placeholder="nama@email.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="register-password">Password</label>

              <div className="register-password-wrap">
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Minimal 6 karakter"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />

                <button
                  type="button"
                  className="register-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Sembunyikan" : "Lihat"}
                </button>
              </div>
            </div>

            <div className="register-field">
              <label htmlFor="register-confirm-password">
                Konfirmasi password
              </label>
              <input
                id="register-confirm-password"
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Ulangi password"
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              className="register-submit"
              disabled={loading}
            >
              {loading ? "Mendaftarkan..." : "Buat Akun"}
              {!loading && <span></span>}
            </button>
          </form>

          <p className="register-switch">
            Sudah punya akun?{" "}
            <button type="button" onClick={onGoLogin}>
              Masuk di sini
            </button>
          </p>

          <div className="register-card-footer">
            Pendaftaran ini ditujukan untuk peminjam.
          </div>
        </section>
      </div>
    </main>
  );
}

export default Register;
