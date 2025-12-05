// scripts/seedUser.js
// Usage: node scripts/seedUser.js +919999999999 1234
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function run() {
  const phone = process.argv[2];
  const pin = process.argv[3];

  if (!phone || !pin) {
    console.error("Usage: node seedUser.js <phone> <pin>");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const exists = await User.findOne({ phone });
  if (exists) {
    console.log("User already exists:", phone);
    process.exit(0);
  }

  const hash = await bcrypt.hash(String(pin), 10);

  const defaultCategories = [
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

  const user = new User({
    phone,
    pinHash: hash,
    today: {
      date: new Date().toISOString().slice(0, 10),
      categories: defaultCategories,
    },
  });

  await user.save();
  console.log("Created user:", phone);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
