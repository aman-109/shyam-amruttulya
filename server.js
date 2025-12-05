// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const dataRoutes = require("./routes/data");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5010;

// connect
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Mongo connected"))
  .catch((err) => {
    console.error("Mongo connect failed:", err.message);
    process.exit(1);
  });

app.use("/api/auth", authRoutes);
app.use("/api", dataRoutes);

// simple root
app.get("/", (req, res) => res.send("Tea-shop backend"));

app.listen(PORT, () => {
  console.log("Server listening on", PORT);
});
