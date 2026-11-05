import "./LandingPage.css";

const KONTAK = {
  alamat: "Payakumbuh, Sumatera Barat",
  whatsapp: "6283190190938",
  nomorWhatsApp: "083190190938",
  instagram: "https://www.instagram.com/",
  namaInstagram: "@vnyajunitaputrii",
  email: "musikku@gmail.com",
  maps: "https://www.google.com/maps/search/?api=1&query=Payakumbuh+Sumatera+Barat",
};

function LandingPage({ onLogin, onRegister }) {
  return (
    <div className="landing-page">
      <nav className="landing-navbar">
        <a className="landing-logo" href="#beranda">
          Musik<span>Ku.</span>
        </a>

        <div className="landing-nav-links">
          <a href="#beranda">Beranda</a>
          <a href="#tentang">Tentang Kami</a>
          <a href="#layanan">Layanan</a>
          <a href="#kontak">Kontak</a>
        </div>

        <div className="landing-nav-buttons">
          <button className="btn-login" onClick={onLogin}>
            Masuk
          </button>
          <button className="btn-register" onClick={onRegister}>
            Daftar
          </button>
        </div>
      </nav>

      <main>
        <section className="landing-hero" id="beranda">
          <div className="hero-content">
            <p className="hero-label">SELAMAT DATANG DI MUSIKKU</p>

            <h1>
              Temukan Alat Musik
              <br />
              untuk <span>Kreasimu.</span>
            </h1>

            <p className="hero-description">
              Butuh alat musik untuk latihan atau berkarya?
              MusikKu hadir untuk membantu proses peminjaman
              alat musik menjadi lebih praktis dan terorganisir.
            </p>

            <div className="hero-buttons">
              <button className="btn-hero-primary" onClick={onRegister}>
                Mulai Meminjam <span></span>
              </button>

              <button className="btn-hero-secondary" onClick={onLogin}>
                Masuk ke Akun
              </button>
            </div>

            <p className="hero-note">
              ♫ Satu tempat untuk kebutuhan musikmu
            </p>
          </div>

          <div className="hero-visual">
            <div className="hero-circle" />

            <span className="music-symbol symbol-one">♪</span>
            <span className="music-symbol symbol-two">♫</span>

            <div className="hero-card">
              <div className="guitar-icon">🎸</div>
              <h2>Mulai Berkarya</h2>
              <p>Temukan irama dan ciptakan karya.</p>
            </div>

            <div className="hero-small-card">
              <span>♫</span>
              <div>
                <strong>Musik untuk semua</strong>
                <p>Belajar · Berlatih · Berkarya</p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-about" id="tentang">
          <p className="section-label">TENTANG MUSIKKU</p>
          <h2>Musik jadi lebih mudah.</h2>
          <p>
            MusikKu merupakan platform peminjaman alat musik
            yang membantu pengguna menemukan dan mengajukan
            peminjaman alat musik dengan lebih mudah.
          </p>
        </section>

        <section className="landing-services" id="layanan">
          <p className="section-label">LAYANAN KAMI</p>
          <h2>Semua berawal dari musik.</h2>

          <div className="service-cards">
            <article className="service-card">
              <span className="service-icon">🎸</span>
              <h3>Pilih Alat Musik</h3>
              <p>
                Lihat pilihan alat musik yang tersedia untuk dipinjam.
              </p>
            </article>

            <article className="service-card">
              <span className="service-icon">📋</span>
              <h3>Peminjaman Praktis</h3>
              <p>
                Ajukan peminjaman melalui sistem yang terorganisir.
              </p>
            </article>

            <article className="service-card">
              <span className="service-icon">🎵</span>
              <h3>Kembangkan Bakat</h3>
              <p>
                Gunakan alat musik untuk belajar, berlatih, dan berkarya.
              </p>
            </article>
          </div>

          <button className="btn-hero-primary" onClick={onRegister}>
            Daftar Sekarang <span></span>
          </button>
        </section>

        <section className="landing-contact" id="kontak">
          <div className="landing-contact-heading">
            <p className="section-label">HUBUNGI KAMI</p>
            <h2>MusikKu siap menemani kreasimu.</h2>
            <p>
              Ada pertanyaan tentang peminjaman alat musik?
              Hubungi kami melalui informasi kontak berikut.
            </p>
          </div>

          <div className="landing-contact-grid">
            <article className="landing-contact-card">
              <div className="landing-contact-icon">📍</div>
              <div className="landing-contact-info">
                <h3>Lokasi Kami</h3>
                <p>{KONTAK.alamat}</p>
                <a
                  href={KONTAK.maps}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Lihat di Google Maps ↗
                </a>
              </div>
            </article>

            <article className="landing-contact-card">
              <div className="landing-contact-icon">💬</div>
              <div className="landing-contact-info">
                <h3>WhatsApp</h3>
                <p>{KONTAK.nomorWhatsApp}</p>
                <a
                  href={`https://wa.me/${KONTAK.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Chat melalui WhatsApp ↗
                </a>
              </div>
            </article>

            <article className="landing-contact-card">
              <div className="landing-contact-icon">📸</div>
              <div className="landing-contact-info">
                <h3>Instagram</h3>
                <p>{KONTAK.namaInstagram}</p>
                <a
                  href={KONTAK.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Kunjungi Instagram ↗
                </a>
              </div>
            </article>

            <article className="landing-contact-card">
              <div className="landing-contact-icon">✉️</div>
              <div className="landing-contact-info">
                <h3>Email</h3>
                <p>{KONTAK.email}</p>
                <a href={`mailto:${KONTAK.email}`}>
                  Kirim email ↗
                </a>
              </div>
            </article>
          </div>

          <div className="landing-contact-cta">
            <div>
              <h3>Siap mulai meminjam?</h3>
              <p>Daftar akun dan temukan alat musik pilihanmu.</p>
            </div>
            <button className="btn-hero-primary" onClick={onRegister}>
              Daftar Sekarang <span></span>
            </button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <a className="landing-logo" href="#beranda">
          Musik<span>Ku.</span>
        </a>

        <p>Temukan irama, ciptakan karya.</p>

        <div className="landing-footer-links">
          <a href="#beranda">Beranda</a>
          <a href="#tentang">Tentang Kami</a>
          <a href="#layanan">Layanan</a>
          <a href="#kontak">Kontak</a>
        </div>

        <div className="landing-footer-contact">
          <a href={`https://wa.me/${KONTAK.whatsapp}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <a href={KONTAK.instagram} target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <a href={`mailto:${KONTAK.email}`}>Email</a>
        </div>

        <small>© {new Date().getFullYear()} MusikKu. Semua hak dilindungi.</small>
      </footer>
    </div>
  );
}

export default LandingPage;
