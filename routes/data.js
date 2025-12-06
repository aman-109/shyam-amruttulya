// routes/data.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");

const User = require("../models/User");
const Report = require("../models/Report");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

// auth middleware
async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ error: "No token" });
    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: "User not found" });
    req.user = user;
    next();
  } catch (err) {
    console.warn("auth error", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * GET /api/data
 * returns { today, reports }
 */
router.get("/data", auth, async (req, res) => {
  try {
    const user = req.user;
    const todayDate = dayjs().format("YYYY-MM-DD");

    // initialize or reset day if needed
    if (!user.today || user.today.date !== todayDate) {
      user.today = {
        date: todayDate,
        categories:
          user.today && Array.isArray(user.today.categories)
            ? user.today.categories.map((c) => ({ ...c, count: 0 }))
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
              ],
      };
      await user.save();
    }

    const reports = await Report.find({ userId: user._id })
      .sort({ date: -1 })
      .lean();

    res.json({ today: user.today, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/today
 * body: { today: { date, categories } }
 *
 * This route merges incoming counts with stored user.today,
 * validates, updates user's today, and upserts the Report doc
 */
router.post("/today", auth, async (req, res) => {
  try {
    const payload = req.body.today;

    if (!payload || !Array.isArray(payload.categories))
      return res.status(400).json({ error: "Invalid today payload" });

    const todayDate = dayjs().format("YYYY-MM-DD");
    const user = req.user;

    // Ensure today.date is correct
    if (!user.today || user.today.date !== todayDate) {
      user.today = {
        date: todayDate,
        categories: payload.categories,
      };
    } else {
      // Merge counts instead of overwriting
      user.today.categories = user.today.categories.map((c) => {
        const incoming = payload.categories.find((x) => x.id === c.id);
        if (!incoming) return c;
        return {
          ...c,
          count: incoming.count, // Only update count from incoming
        };
      });
    }

    await user.save();

    res.json({ ok: true, today: user.today });
  } catch (err) {
    console.error("/today merge error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
/**
 * POST /api/close
 * creates/upserts the report for today and resets user.today counts to 0
 */
router.post("/close", auth, async (req, res) => {
  try {
    const user = req.user;
    const todayDate = dayjs().format("YYYY-MM-DD");

    const categories =
      user.today && Array.isArray(user.today.categories)
        ? user.today.categories
        : [];

    const items = categories
      .filter((c) => c.count > 0)
      .map((c) => ({
        id: Number(c.id),
        name: String(c.name),
        price: Number(c.price),
        count: Number(c.count),
        amount: Number(c.count) * Number(c.price),
      }))
      .filter((it) => !isNaN(it.amount));

    const totalQty = items.reduce((s, it) => s + it.count, 0);
    const totalAmount = items.reduce((s, it) => s + it.amount, 0);

    await Report.findOneAndUpdate(
      { userId: user._id, date: todayDate },
      { userId: user._id, date: todayDate, items, totalQty, totalAmount },
      { upsert: true, new: true }
    );

    // reset counts for user.today (preserve structure)
    user.today = {
      date: todayDate,
      categories: categories.map((c) => ({ ...c, count: 0 })),
    };
    await user.save();

    const reports = await Report.find({ userId: user._id })
      .sort({ date: -1 })
      .lean();
    res.json({ ok: true, today: user.today, reports });
  } catch (err) {
    console.error("POST /close error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/reports
 */
router.get("/reports", auth, async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.user._id })
      .sort({ date: -1 })
      .lean();
    res.json({ reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/reports/:id
 */
router.delete("/reports/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;
    await Report.deleteOne({ _id: id, userId: req.user._id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
