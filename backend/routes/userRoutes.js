const express = require("express");
const router = express.Router();

const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} = require("../controllers/userController");

const {
  verifyToken,
  verifyAdmin,
} = require("../middleware/authMiddleware");

router.use(verifyToken, verifyAdmin);

router.get("/", getUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;