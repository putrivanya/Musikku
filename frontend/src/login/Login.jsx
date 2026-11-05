
import { useState } from "react";
import Captcha from "../components/Captcha.jsx";
import "./Login.css";
import { api, getErrorMessage, setSession } from "../api.js";

function Login({ onLoginSuccess, onBack, onGoRegister }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaValid, setCaptchaValid] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.email.trim() || !form.password) {
      setError("Email dan password wajib diisi.");
      return;
    }

    if (!captchaValid) {
      setError("Silakan verifikasi CAPTCHA terlebih dahulu.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        email: form.email.trim(),
        password: form.password,
      });

      const data = response.data || {};
      const token = data.token;
      const user = data.user;

      if (!token || typeof token !== "string") {
        throw new Error(
          "Token tidak ditemukan pada respons API. Periksa backend login."
        );
      }

      if (!user || typeof user !== "object") {
        throw new Error(
          "Data pengguna tidak ditemukan pada respons API."
        );
      }

      setSession(token, user);

      if (typeof onLoginSuccess === "function") {
        onLoginSuccess(user);
      }
    } catch (err) {
      console.error("Gagal login:", err);

      setError(
        getErrorMessage(
          err,
          "Tidak dapat menghubungi server. Periksa koneksi backend."
        )
      );

      // Reset CAPTCHA setelah login gagal
      setCaptchaValid(false);
      setCaptchaKey((prev) => prev + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />

      <button
        type="button"
        className="auth-back"
        onClick={onBack}
      >
        <span aria-hidden="true"></span>
        Kembali ke Beranda
      </button>

      <div className="auth-layout">

        {/* BAGIAN KIRI */}
        <section className="auth-intro">
          <a
            href="#beranda"
            className="auth-logo"
            onClick={(e) => {
              e.preventDefault();
              onBack?.();
            }}
          >
            Musik<span>Ku.</span>
          </a>

          <p className="auth-eyebrow">
            SELAMAT DATANG KEMBALI
          </p>

          <h1>
            Temukan irama,
            <br />
            lanjutkan <span>karyamu.</span>
          </h1>

          <p className="auth-intro-description">
            Masuk ke akun MusikKu dan nikmati kemudahan
            mengajukan peminjaman alat musik untuk belajar,
            berlatih, dan berkarya.
          </p>

          <div className="auth-highlight">
            <span className="auth-highlight-icon">♫</span>

            <div>
              <strong>Musik untuk semua</strong>
              <p>Belajar · Berlatih · Berkarya</p>
            </div>
          </div>
        </section>

        {/* BAGIAN KANAN */}
        <section className="auth-card">
          <div className="auth-card-heading">
            <div className="auth-card-icon">♫</div>

            <p className="auth-card-label">
              AKUN MUSIKKU
            </p>

            <h2>Masuk ke akun</h2>

            <p>Masukkan email dan password kamu.</p>
          </div>

          {/* PESAN ERROR */}
          {error && (
            <div className="auth-alert" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {/* EMAIL */}
            <div className="auth-field">
              <label htmlFor="login-email">
                Email
              </label>

              <input
                id="login-email"
                type="email"
                name="email"
                placeholder="nama@email.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>

            {/* PASSWORD */}
            <div className="auth-field">
              <label htmlFor="login-password">
                Password
              </label>

              <div className="auth-password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Masukkan password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() =>
                    setShowPassword((prev) => !prev)
                  }
                  aria-label={
                    showPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                >
                  {showPassword ? "Sembunyikan" : "Lihat"}
                </button>
              </div>
            </div>

            {/* CAPTCHA */}
            <div className="auth-captcha">
              <Captcha
                key={captchaKey}
                onVerify={(benar) => {
                  setCaptchaValid(benar);

                  if (benar) {
                    setError("");
                  }
                }}
              />
            </div>

            {/* TOMBOL LOGIN */}
            <button
              type="submit"
              className="auth-submit"
              disabled={loading || !captchaValid}
            >
              {loading ? "Memproses..." : "Masuk ke Akun"}

              {!loading && <span></span>}
            </button>
          </form>

          {/* LINK REGISTER */}
          <p className="auth-switch">
            Belum punya akun?{" "}

            <button
              type="button"
              onClick={onGoRegister}
            >
              Daftar sekarang
            </button>
          </p>

          <div className="auth-card-footer">
            Dengan masuk, kamu dapat melanjutkan ke layanan
            peminjaman alat musik MusikKu.
          </div>
        </section>
      </div>
    </main>
  );
}

export default Login;
