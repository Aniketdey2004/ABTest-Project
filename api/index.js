import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import serverless from "serverless-http";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());

// ====== MongoDB Setup ======
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ database connected successfully"))
  .catch(err => console.error(err));

// ====== Schema ======
const eventSchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now },
  userId: String,
  variant: { type: String, enum: ["A", "B"] },
  event: { type: String, enum: ["impression", "click"] },
});
const Event = mongoose.model("Event", eventSchema);

// ====== API Routes ======
app.post("/event", async (req, res) => {
  console.log("hi")
  const userId = req.cookies.uid;
  const variant = req.cookies.variant;
  const event = req.body.event;

  if (userId && variant && event === "click") {
    await Event.create({ userId, variant, event });
  }
  res.json({ ok: true });
});

app.get("/stats", async (req, res) => {
  const pipeline = [
    { $group: { _id: { variant: "$variant", event: "$event" }, count: { $sum: 1 } } },
  ];
  const results = await Event.aggregate(pipeline);

  const tallies = { A: { impression: 0, click: 0 }, B: { impression: 0, click: 0 } };
  results.forEach((r) => {
    tallies[r._id.variant][r._id.event] = r.count;
  });

  res.json(tallies);
});

export default serverless(app);
