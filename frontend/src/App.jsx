import { useEffect, useState } from "react";

import LandingPage from "./LandingPage/LandingPage.jsx";
import Login from "./login/Login.jsx";
import Register from "./register/Register.jsx";

import AdminDashboard from "./AdminDashboard/AdminDashboard.jsx";
import PeminjamDashboard from "./PeminjamDashboard/PeminjamDashboard.jsx";
import PetugasDashboard from "./PetugasDashboard/PetugasDashboard.jsx";

import {
  api,
  clearSession,
  getSessionUser,
  getToken,
  logoutSession,
  setSession,
} from "./api.js";

function App() {
  const [page, setPage] = useState(
    getToken() ? "loading" : "landing"
  );
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(getSessionUser());

  // Jangan percaya role dari localStorage. Validasi token dan ambil
  // data pengguna terbaru dari backend saat aplikasi dibuka.
  useEffect(() => {
    const token = getToken();

    if (!token) {
      setPage("landing");
      return undefined;
    }

    let aktif = true;

    api
      .get("/auth/me")
      .then(({ data }) => {
        if (!aktif) return;

        if (!data?.user) {
          throw new Error("Data sesi tidak valid.");
        }

        setSession(token, data.user);
        setUser(data.user);
        setLoggedIn(true);
        setPage("dashboard");
      })
      .catch(() => {
        if (!aktif) return;

        clearSession();
        setUser({});
        setLoggedIn(false);
        setPage("landing");
      });

    return () => {
      aktif = false;
    };
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      setUser({});
      setLoggedIn(false);
      setPage("landing");
    }

    window.addEventListener(
      "musikku:session-expired",
      handleSessionExpired
    );

    return () => {
      window.removeEventListener(
        "musikku:session-expired",
        handleSessionExpired
      );
    };
  }, []);

  function handleLoginSuccess(userData) {
    const token = getToken();

    if (!token || !userData || !Object.keys(userData).length) {
      clearSession();
      setUser({});
      setLoggedIn(false);
      setPage("login");
      return;
    }

    setSession(token, userData);

    setUser(userData);
    setLoggedIn(true);
    setPage("dashboard");
  }

  async function handleLogout() {
    await logoutSession();

    setUser({});
    setLoggedIn(false);
    setPage("landing");
  }

  if (page === "loading") {
    return (
      <main style={{ padding: "32px", textAlign: "center" }}>
        <h2>Memeriksa sesi login...</h2>
        <p>Mohon tunggu sebentar.</p>
      </main>
    );
  }

  if (page === "dashboard" && loggedIn) {
    const roleId = Number(user?.role_id);
    const role = String(user?.role || "")
      .toLowerCase()
      .trim();

    if (roleId === 1 || role === "admin") {
      return <AdminDashboard onLogout={handleLogout} />;
    }

    if (roleId === 2 || role === "petugas") {
      return <PetugasDashboard onLogout={handleLogout} />;
    }

    if (roleId === 3 || role === "peminjam") {
      return <PeminjamDashboard onLogout={handleLogout} />;
    }

    return (
      <main style={{ padding: "32px", textAlign: "center" }}>
        <h2>Role akun tidak dikenali</h2>

        <p>
          Role akun tidak ditemukan atau tidak sesuai.
          Silakan periksa data role akun di database.
        </p>

        <button onClick={handleLogout}>
          Kembali ke Beranda
        </button>
      </main>
    );
  }

  if (page === "login") {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onBack={() => setPage("landing")}
        onGoRegister={() => setPage("register")}
      />
    );
  }

  if (page === "register") {
    return (
      <Register
        onBack={() => setPage("landing")}
        onGoLogin={() => setPage("login")}
        onRegisterSuccess={() => setPage("login")}
      />
    );
  }

  return (
    <LandingPage
      onLogin={() => setPage("login")}
      onRegister={() => setPage("register")}
    />
  );
}

export default App;
