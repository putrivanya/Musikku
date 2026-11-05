
const express = require("express");
const router = express.Router();

const {
  getAllLogAktivitas,
} = require("../controllers/logAktivitasController");

const {
  verifyToken,
  verifyAdmin,
} = require("../middleware/authMiddleware");

router.get("/", verifyToken, verifyAdmin, getAllLogAktivitas);

module.exports = router;
