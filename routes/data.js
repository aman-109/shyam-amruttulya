// routes/data.js (FULL PATCHED VERSION)
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");
const defaultCategories = require("../config/defaultCategories");

const User = require("../models/User");
const Report = require("../models/Report");

const JWT_SECRET = process.env.JWT_SECRET;

// ---------------------------
// AUTH MIDDLEWARE
// ---------------------------
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

// ---------------------------
// GET /api/data
// ---------------------------
// RETURNS → today + all reports
// NO WRITING TO DATABASE (IMPORTANT !!!)
// ---------------------------
router.get("/data", auth, async (req, res) => {
  try {
    const user = req.user;
    const todayDate = dayjs().format("YYYY-MM-DD");

    let today = user.today;

    // If no today data OR new day → generate fresh in-memory today
    if (!today || today.date !== todayDate) {
      today = {
        date: todayDate,
        categories: defaultCategories.map((c) => ({ ...c, count: 0 })),
      };
    } else {
      // merge missing categories (in-memory only)
      today = {
        date: today.date,
        categories: defaultCategories.map((def) => {
          const stored = user.today.categories.find((c) => c.id === def.id);
          return stored
            ? { ...def, count: stored.count }
            : { ...def, count: 0 };
        }),
      };
    }

    // DO *NOT* SAVE today back to DB → prevents overwriting historical reports
    // await user.save();  ❌ REMOVED FOREVER

    const reports = await Report.find({ userId: user._id })
      .sort({ date: -1 })
      .lean();

    res.json({ today, reports });
  } catch (err) {
    console.error("GET /data error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------
// POST /api/today
// SAFE MODE — DOES NOT TOUCH OLD REPORTS
// Only updates today's report
// ---------------------------
router.post("/today", auth, async (req, res) => {
  try {
    const payload = req.body.today;
    if (!payload || !Array.isArray(payload.categories)) {
      return res.status(400).json({ error: "Invalid today payload" });
    }

    const user = req.user;
    const todayDate = payload.date || dayjs().format("YYYY-MM-DD");

    // Save today's state on user (ONLY today)
    user.today = {
      date: todayDate,
      categories: payload.categories.map((c) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        count: Number(c.count || 0),
      })),
    };
    await user.save();

    // Build today's report items
    const items = user.today.categories
      .filter((c) => c.count > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        count: c.count,
        amount: c.count * c.price,
      }));

    const totalQty = items.reduce((s, it) => s + it.count, 0);
    const totalAmount = items.reduce((s, it) => s + it.amount, 0);

    // UPSERT ONLY TODAY — WILL NOT TOUCH OTHER DATES
    const updatedReport = await Report.findOneAndUpdate(
      { userId: user._id, date: todayDate },
      {
        userId: user._id,
        date: todayDate,
        items,
        totalQty,
        totalAmount,
      },
      { upsert: true, new: true }
    );

    const reports = await Report.find({ userId: user._id })
      .sort({ date: -1 })
      .lean();

    res.json({ ok: true, today: user.today, updatedReport, reports });
  } catch (err) {
    console.error("POST /today error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------
// POST /api/close
// FINALIZES TODAY REPORT
// DOES NOT TOUCH OLD REPORTS
// ---------------------------
router.post("/close", auth, async (req, res) => {
  try {
    const user = req.user;
    const todayDate = dayjs().format("YYYY-MM-DD");

    const categories = user.today?.categories || [];

    const items = categories
      .filter((c) => c.count > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        count: c.count,
        amount: c.count * c.price,
      }));

    const totalQty = items.reduce((s, it) => s + it.count, 0);
    const totalAmount = items.reduce((s, it) => s + it.amount, 0);

    await Report.findOneAndUpdate(
      { userId: user._id, date: todayDate },
      { userId: user._id, date: todayDate, items, totalQty, totalAmount },
      { upsert: true, new: true }
    );

    // Reset TODAY only (safe)
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

// ---------------------------
// GET /api/reports
// ---------------------------
router.get("/reports", auth, async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.user._id })
      .sort({ date: -1 })
      .lean();
    res.json({ reports });
  } catch (err) {
    console.error("GET /reports error", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------
// DELETE /api/reports/:id
// ---------------------------
router.delete("/reports/:id", auth, async (req, res) => {
  try {
    await Report.deleteOne({ _id: req.params.id, userId: req.user._id });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /reports error", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
