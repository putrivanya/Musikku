const express = require("express");

const {
  register,
  login,
  me,
  logout,
} = require("../controllers/authController");

const { verifyToken } = require("../middleware/authMiddleware");
const {
  loginLimiter,
  registerLimiter,
} = require("../middleware/rateLimit");

const router = express.Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.get("/me", verifyToken, me);
router.post("/logout", verifyToken, logout);

module.exports = router;
