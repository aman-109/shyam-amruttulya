// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");
const defaultCategories = require("../config/defaultCategories");
const User = require("../models/User");
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

// POST /api/auth/login
// body: { phone, pin }
router.post("/login", async (req, res) => {
  try {
    console.log(req.body);
    const { phone, pin } = req.body;
    if (!phone || !pin)
      return res.status(400).json({ error: "Missing phone or pin" });

    const user = await User.findOne({ phone });
    if (!user) return res.status(401).json({ error: "User not found" });

    const ok = await bcrypt.compare(String(pin), user.pinHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const todayDate = dayjs().format("YYYY-MM-DD");

    // Reset day OR if categories missing, rebuild
    if (!user.today || user.today.date !== todayDate) {
      user.today = {
        date: todayDate,
        categories: defaultCategories.map((c) => ({ ...c, count: 0 })),
      };
    } else {
      // Merge missing categories
      user.today.categories = defaultCategories.map((def) => {
        const existing = user.today.categories.find((c) => c.id === def.id);
        return existing
          ? { ...def, count: existing.count }
          : { ...def, count: 0 };
      });
    }

    await user.save();

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token });
  } catch (err) {
    console.error("LOGIN ERR", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
