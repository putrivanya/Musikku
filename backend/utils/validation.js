const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9._@-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function teks(value, maxLength = 255) {
  if (typeof value !== "string") return null;

  const hasil = value.trim();

  if (!hasil || hasil.length > maxLength) return null;

  return hasil;
}

function teksOpsional(value, maxLength = 255) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return null;

  const hasil = value.trim();

  if (!hasil) return null;
  if (hasil.length > maxLength) return null;

  return hasil;
}

function idValid(value) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

function emailValid(value) {
  const email = teks(value, 150);

  return email && EMAIL_RE.test(email) ? email.toLowerCase() : null;
}

function usernameValid(value) {
  const username = teks(value, 50);

  if (!username || username.length < 3 || !USERNAME_RE.test(username)) {
    return null;
  }

  return username;
}

function passwordError(value) {
  if (typeof value !== "string" || value.length < 8) {
    return "Password minimal 8 karakter.";
  }

  if (value.length > 72 || Buffer.byteLength(value, "utf8") > 72) {
    return "Password maksimal 72 karakter (72 byte).";
  }

  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return "Password harus memuat huruf dan angka.";
  }

  return null;
}

function tanggalValid(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    return false;
  }

  const [tahun, bulan, hari] = value.split("-").map(Number);
  const date = new Date(Date.UTC(tahun, bulan - 1, hari));

  return (
    date.getUTCFullYear() === tahun &&
    date.getUTCMonth() === bulan - 1 &&
    date.getUTCDate() === hari
  );
}

function tanggalHariIni() {
  const sekarang = new Date();

  return [
    sekarang.getFullYear(),
    String(sekarang.getMonth() + 1).padStart(2, "0"),
    String(sekarang.getDate()).padStart(2, "0"),
  ].join("-");
}

function selisihHari(dari, sampai) {
  if (!tanggalValid(dari) || !tanggalValid(sampai)) return null;

  const awal = new Date(`${dari}T00:00:00.000Z`);
  const akhir = new Date(`${sampai}T00:00:00.000Z`);

  return Math.round((akhir.getTime() - awal.getTime()) / 86400000);
}

module.exports = {
  teks,
  teksOpsional,
  idValid,
  emailValid,
  usernameValid,
  passwordError,
  tanggalValid,
  tanggalHariIni,
  selisihHari,
};
