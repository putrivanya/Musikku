
const env = require("./config/env");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

const db = require("./config/database");

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const alatRoutes = require("./routes/alatRoutes");
const kategoriRoutes = require("./routes/kategoriRoutes");
const peminjamanRoutes = require("./routes/peminjamanRoutes");
const pengembalianRoutes = require("./routes/pengembalianRoutes");
const logAktivitasRoutes = require("./routes/logAktivitasRoutes");

// Middleware
const logAktivitasMiddleware = require("./middleware/logAktivitasMiddleware");

const app = express();

// ========================================
// 1. BASIC CONFIGURATION
// ========================================

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.disable("etag");

// ========================================
// 2. SECURITY HELMET
// ========================================

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        baseUri: ["'self'"],

        formAction: ["'self'"],

        frameAncestors: ["'none'"],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
        ],

        imgSrc: [
          "'self'",
          "data:",
          "https:",
        ],

        fontSrc: [
          "'self'",
          "data:",
          "https:",
        ],

        connectSrc: [
          "'self'",
          "http://localhost:5000",
          "http://127.0.0.1:5000",
        ],

        objectSrc: ["'none'"],

        upgradeInsecureRequests: null,
      },
    },

    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },

    referrerPolicy: {
      policy: "no-referrer",
    },
  })
);

// ========================================
// 3. CORS CONFIGURATION
// ========================================

app.use(
  cors({
    origin(origin, callback) {
      // Request tanpa Origin, misalnya curl.
      if (!origin) {
        return callback(null, true);
      }

      const originBersih = origin.replace(/\/+$/, "");

      if (env.CORS_ORIGINS.includes(originBersih)) {
        return callback(null, true);
      }

      const error = new Error(
        `Origin ${origin} tidak diizinkan oleh kebijakan CORS.`
      );

      error.status = 403;

      return callback(error);
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
    ],

    exposedHeaders: [
      "Retry-After",
    ],

    maxAge: 600,

    credentials: false,
  })
);

// ========================================
// 4. BODY PARSER
// ========================================

app.use(
  express.json({
    limit: "100kb",
    strict: true,
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "100kb",
  })
);

// ========================================
// 5. API CACHE CONTROL
// ========================================

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// ========================================
// 6. UPLOAD FILE CONFIGURATION
// ========================================

app.use(
  "/uploads",

  (req, res, next) => {
    const ekstensi = path.extname(req.path).toLowerCase();

    const formatDiizinkan = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
    ];

    if (!formatDiizinkan.includes(ekstensi)) {
      return res.status(404).json({
        success: false,
        message: "File tidak ditemukan.",
      });
    }

    next();
  },

  express.static(
    path.join(__dirname, "uploads"),
    {
      dotfiles: "deny",
      index: false,
      maxAge: "1d",

      setHeaders(res) {
        res.setHeader(
          "X-Content-Type-Options",
          "nosniff"
        );

        res.setHeader(
          "Cross-Origin-Resource-Policy",
          "cross-origin"
        );
      },
    }
  )
);

// ========================================
// 7. ROOT API
// ========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API MusikKu berhasil dijalankan.",
  });
});

// ========================================
// 8. HEALTH CHECK
// ========================================

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");

    return res.json({
      success: true,
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error(
      "Health check:",
      error.message
    );

    return res.status(503).json({
      success: false,
      status: "degraded",
      database: "disconnected",
    });
  }
});

// ========================================
// 9. SWAGGER DOCUMENTATION
// ========================================

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,

    customSiteTitle: "MusikKu API Documentation",

    swaggerOptions: {
      persistAuthorization: true,

      displayRequestDuration: true,

      filter: true,

      tryItOutEnabled: true,
    },
  })
);

// ========================================
// 10. ACTIVITY LOG MIDDLEWARE
// ========================================

app.use(logAktivitasMiddleware);

// ========================================
// 11. API ROUTES
// ========================================

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/alat", alatRoutes);

app.use("/api/kategori", kategoriRoutes);

app.use("/api/peminjaman", peminjamanRoutes);

app.use("/api/pengembalian", pengembalianRoutes);

app.use("/api/log-aktivitas", logAktivitasRoutes);

// ========================================
// 12. GLOBAL ERROR HANDLER
// ========================================

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // JSON tidak valid
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Body request bukan JSON yang valid.",
    });
  }

  // Request terlalu besar
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Ukuran request terlalu besar.",
    });
  }

  // Error Multer
  if (err.name === "MulterError") {
    let message = "Upload file gagal.";

    if (err.code === "LIMIT_FILE_SIZE") {
      message = `Ukuran foto maksimal ${Math.round(
        env.UPLOAD_MAX_BYTES / (1024 * 1024)
      )} MB.`;
    }

    return res.status(400).json({
      success: false,
      message,
    });
  }

  // Error CORS dan error client lainnya
  if (err.status && err.status < 500) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
    });
  }

  // Error server
  console.error("Server error:", err);

  return res.status(500).json({
    success: false,
    message: "Terjadi kesalahan pada server.",
  });
});

// ========================================
// 13. 404 NOT FOUND
// ========================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
});

// ========================================
// 14. START SERVER
// ========================================

async function startServer() {
  try {
    // Periksa database
    await db.query("SELECT 1");

    console.log("Database MySQL berhasil terhubung.");

    const server = app.listen(env.PORT, () => {
      console.log("--------------------------------");
      console.log("       MUSIKKU API SERVER");
      console.log("--------------------------------");

      console.log(
        `Server berjalan di port ${env.PORT}`
      );

      console.log(
        `Environment: ${env.NODE_ENV}`
      );

      console.log(
        `API utama: http://localhost:${env.PORT}`
      );

      console.log(
        `Health check: http://localhost:${env.PORT}/api/health`
      );

      console.log(
        `Swagger UI: http://localhost:${env.PORT}/api-docs`
      );

      console.log(
        "CORS Origins:",
        env.CORS_ORIGINS
      );

      console.log("--------------------------------");
    });

    // ====================================
    // GRACEFUL SHUTDOWN
    // ====================================

    let shuttingDown = false;

    async function shutdown(signal) {
      if (shuttingDown) return;

      shuttingDown = true;

      console.log(
        `${signal} diterima, menutup server...`
      );

      const timeout = setTimeout(() => {
        console.error(
          "Shutdown timeout. Memaksa proses berhenti."
        );

        process.exit(1);
      }, 10000);

      timeout.unref();

      server.close(async () => {
        try {
          await db.end();

          console.log(
            "Koneksi database berhasil ditutup."
          );

          process.exit(0);
        } catch (error) {
          console.error(
            "Gagal menutup database:",
            error.message
          );

          process.exit(1);
        }
      });
    }

    process.on("SIGINT", () => {
      shutdown("SIGINT");
    });

    process.on("SIGTERM", () => {
      shutdown("SIGTERM");
    });

    return server;

  } catch (error) {
    console.error(
      "Gagal menjalankan server:",
      error.message
    );

    process.exit(1);
  }
}

// ========================================
// 15. EXPORT APPLICATION
// ========================================

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};
