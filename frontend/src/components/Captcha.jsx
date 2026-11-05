
import { useState } from "react";
import "./Captcha.css";

// Membuat CAPTCHA berupa 6 angka acak
function buatKode() {
  return String(
    Math.floor(100000 + Math.random() * 900000)
  );
}

function Captcha({ onVerify }) {
  const [kode, setKode] = useState(buatKode());
  const [jawaban, setJawaban] = useState("");
  const [status, setStatus] = useState("");

  // Membuat kode baru
  function refreshCaptcha() {
    setKode(buatKode());
    setJawaban("");
    setStatus("");
    onVerify(false);
  }

  // Mengubah jawaban
  function handleChange(e) {
    const value = e.target.value;

    // Hanya menerima angka
    if (!/^\d*$/.test(value)) {
      return;
    }

    // Maksimal 6 digit
    if (value.length > 6) {
      return;
    }

    setJawaban(value);
    setStatus("");
    onVerify(false);
  }

  // Verifikasi CAPTCHA
  function verifikasi() {
    if (jawaban.length !== 6) {
      setStatus("Masukkan 6 angka CAPTCHA.");
      onVerify(false);
      return;
    }

    // Perbandingan persis, tanpa mengubah format
    const benar = jawaban === kode;

    if (benar) {
      setStatus("CAPTCHA berhasil diverifikasi!");
      onVerify(true);
    } else {
      setStatus("Kode CAPTCHA salah. Coba lagi.");

      onVerify(false);

      // Buat kode baru jika salah
      setKode(buatKode());
      setJawaban("");
    }
  }

  return (
    <div className="captcha-container">

      {/* JUDUL */}
      <div className="captcha-heading">
        <label>Verifikasi</label>
        <span>Pastikan kamu bukan robot</span>
      </div>

      {/* KODE CAPTCHA */}
      <div className="captcha-code">
        <span>{kode}</span>

        <button
          type="button"
          className="captcha-refresh"
          onClick={refreshCaptcha}
          title="Ganti kode CAPTCHA"
          aria-label="Refresh CAPTCHA"
        >
          ↻
        </button>
      </div>

      {/* INPUT CAPTCHA */}
      <input
        type="text"
        className="captcha-input"
        placeholder="Masukkan 6 digit angka"
        value={jawaban}
        onChange={handleChange}
        maxLength={6}
        inputMode="numeric"
        pattern="[0-9]{6}"
        autoComplete="off"
      />

      {/* TOMBOL VERIFIKASI */}
      <button
        type="button"
        className="captcha-verify"
        onClick={verifikasi}
        disabled={jawaban.length !== 6}
      >
        Verifikasi Kode
      </button>

      {/* STATUS CAPTCHA */}
      {status && (
        <p
          role="status"
          style={{
            marginTop: 8,
            marginBottom: 0,
            fontSize: 12,
            fontWeight: 600,
            color: status.includes("berhasil")
              ? "#15803d"
              : "#dc2626",
          }}
        >
          {status}
        </p>
      )}
    </div>
  );
}

export default Captcha;
