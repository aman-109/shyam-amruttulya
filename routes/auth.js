// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");

const User = require("../models/User");
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

// POST /api/auth/login
// body: { phone, pin }
router.post("/login", async (req, res) => {
  try {
    console.log(req.body)
    const { phone, pin } = req.body;
    if (!phone || !pin) return res.status(400).json({ error: "Missing phone or pin" });

    const user = await User.findOne({ phone });
    if (!user) return res.status(401).json({ error: "User not found" });

    const ok = await bcrypt.compare(String(pin), user.pinHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // ensure today's structure exists and date is correct
    const todayDate = dayjs().format("YYYY-MM-DD");
    if (!user.today || user.today.date !== todayDate) {
      // if user.today exists but for previous date, reset counts to 0 preserving structure
      const defaultCats = user.today && Array.isArray(user.today.categories)
        ? user.today.categories.map(c => ({ ...c, count: 0 }))
        : [
            { id: 1, name: "Tea", price: 10, count: 0 },
            { id: 2, name: "Coffee", price: 20, count: 0 },
            { id: 3, name: "Black Coffee", price: 15, count: 0 },
            { id: 4, name: "Cigarette (₹10)", price: 10, count: 0 },
            { id: 5, name: "Cigarette (₹12)", price: 12, count: 0 },
            { id: 6, name: "Cigarette (₹17)", price: 17, count: 0 },
            { id: 7, name: "Cigarette (₹20)", price: 20, count: 0 },
            { id: 8, name: "Biscuits", price: 5, count: 0 },
            { id: 9, name: "Sweet", price: 5, count: 0 },
            { id: 10, name: "Water Bottle (Small)", price: 10, count: 0 },
            { id: 11, name: "Water Bottle (Large)", price: 20, count: 0 },
            { id: 12, name: "Doughnut", price: 10, count: 0 },
          ];

      user.today = { date: todayDate, categories: defaultCats };
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token });
  } catch (err) {
    console.error("LOGIN ERR", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
