// models/User.js
const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema({
  id: Number,
  name: String,
  price: Number,
  count: { type: Number, default: 0 },
}, { _id: false });

const TodaySchema = new mongoose.Schema({
  date: String, // YYYY-MM-DD
  categories: [CategorySchema],
}, { _id: false });

const UserSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  pinHash: { type: String, required: true },
  today: { type: TodaySchema, default: null }, // initialize once on create/login
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);
