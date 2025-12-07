// scripts/seedUser.js
// Usage: node scripts/seedUser.js +919999999999 1234
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const defaultCategories = require("../config/defaultCategories");

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
