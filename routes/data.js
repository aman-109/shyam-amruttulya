// routes/data.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");
const defaultCategories = require("../config/defaultCategories");

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


    // If first-time user or new day → initialize clean today
    if (!user.today || user.today.date !== todayDate) {
      user.today = {
        date: todayDate,
        categories: defaultCategories.map((c) => ({ ...c, count: 0 })),
      };
      await user.save();
    }

    // Merge missing categories (important: FIX)
    const mergedCategories = defaultCategories.map((defCat) => {
      const stored = user.today.categories.find((c) => c.id === defCat.id);
      return stored
        ? { ...defCat, count: stored.count } // preserve count
        : { ...defCat, count: 0 }; // new category
    });

    // Replace stored categories with merged result
    user.today.categories = mergedCategories;
    await user.save();

    // Reports
    const reports = await Report.find({ userId: user._id })
      .sort({ date: -1 })
      .lean();

    res.json({ today: user.today, reports });
  } catch (err) {
    console.error("GET /data", err);
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

    if (!payload || !Array.isArray(payload.categories)) {
      return res.status(400).json({ error: "Invalid today payload" });
    }

    const user = req.user;
    const todayDate = payload.date || dayjs().format("YYYY-MM-DD");

    // 1️⃣ Save TODAY counts
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

    // 2️⃣ Construct "items" only for non-zero items
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

    // 3️⃣ UPSERT report document for today's date
    const updatedReport = await Report.findOneAndUpdate(
      { userId: user._id, date: todayDate },
      {
        userId: user._id,
        date: todayDate,
        items,
        totalQty,
        totalAmount,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 4️⃣ Also get fresh list of all reports
    const reports = await Report.find({ userId: user._id })
      .sort({ date: -1 })
      .lean();

    res.json({
      ok: true,
      today: user.today,
      updatedReport,
      reports,
    });
  } catch (err) {
    console.error("POST /today error:", err);
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
