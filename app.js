import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cookieParser());


// ====== MongoDB Setup ======
await mongoose.connect("mongodb://127.0.0.1:27017/abtest");

const eventSchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now },
  userId: String,
  variant: { type: String, enum: ["A", "B"] },
  event: { type: String, enum: ["impression", "click"] },
});
const Event = mongoose.model("Event", eventSchema);

// ====== Routes ======

// Serve homepage with variant assignment
app.get("/", async (req, res) => {
  let variant = req.cookies.variant;
  console.log(variant);
  if (!variant) {
    variant = Math.random() < 0.5 ? "A" : "B";
    res.cookie("variant", variant, { maxAge: 7 * 24 * 3600 * 1000, path: "/" });
  }

  let userId = req.cookies.uid;
  if (!userId) {
    userId = "u" + Date.now() + Math.floor(Math.random() * 1000);
    res.cookie("uid", userId, { maxAge: 30 * 24 * 3600 * 1000, path: "/" });
  }

  // Log impression
  await Event.create({ userId, variant, event: "impression" });

  // Send HTML page
  res.sendFile(path.join(__dirname, "public/index.html"));
});


app.post("/event", async (req, res) => {
  const userId = req.cookies.uid;
  const variant = req.cookies.variant;
  const event = req.body.event;

  console.log("From cookie:", userId, variant, event);

  if (userId && variant && event === "click") {
    await Event.create({ userId, variant, event });
    console.log("success");
  }
  res.json({ ok: true });
});

// Show stats
app.get("/stats", async (req, res) => {
  const pipeline = [
    {
      $group: {
        _id: { variant: "$variant", event: "$event" },
        count: { $sum: 1 },
      },
    },
  ];
  const results = await Event.aggregate(pipeline);

  const tallies = {
    A: { impression: 0, click: 0 },
    B: { impression: 0, click: 0 },
  };
  results.forEach((r) => {
    tallies[r._id.variant][r._id.event] = r.count;
  });

  res.json(tallies);
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
