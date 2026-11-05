
const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");
const fs = require("fs");

const folderRoutes = path.resolve(__dirname, "routes");

// Membaca semua file route
const daftarFile = fs
  .readdirSync(folderRoutes)
  .filter((file) => file.endsWith(".js"))
  .map((file) => path.join(folderRoutes, file));

console.log("Folder route:", folderRoutes);
console.log("File route ditemukan:", daftarFile);

// Memeriksa komentar Swagger
daftarFile.forEach((file) => {
  const isiFile = fs.readFileSync(file, "utf8");

  console.log(
    `${path.basename(file)} memiliki @swagger:`,
    isiFile.includes("@swagger")
  );
});

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "API MusikKu",
      version: "1.0.0",
      description:
        "Dokumentasi REST API Sistem Peminjaman Alat Musik MusikKu.",
    },

    servers: [
      {
        url: "http://localhost:5000",
        description: "Local Development Server",
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Masukkan token JWT.",
        },
      },
    },

    tags: [
      {
        name: "Alat Musik",
        description: "Endpoint pengelolaan alat musik.",
      },
    ],
  },

  apis: daftarFile,
};

const swaggerSpec = swaggerJsdoc(options);

// Menampilkan endpoint yang berhasil dideteksi
console.log(
  "Endpoint Swagger:",
  Object.keys(swaggerSpec.paths || {})
);

module.exports = swaggerSpec;
