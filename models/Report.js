// models/Report.js
const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  id: Number,
  name: String,
  price: Number,
  count: Number,
  amount: Number,
}, { _id: false });

const ReportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  items: [ItemSchema],
  totalQty: Number,
  totalAmount: Number,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Report", ReportSchema);
