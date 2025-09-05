import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv"; // <-- Add this line
import serverless from "serverless-http";

dotenv.config(); // <-- Load environment variables

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cookieParser());


// ====== MongoDB Setup ======
main()
.then(()=>{
  console.log("database connected successfully");
})
.catch((err)=>{
  console.log(err);
})
async function  main(){
  await mongoose.connect(process.env.MONGODB_URI);
}
 // <-- Use env variable

const eventSchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now },
  userId: String,
  variant: { type: String, enum: ["A", "B"] },
  event: { type: String, enum: ["impression", "click"] },
});
const Event = mongoose.model("Event", eventSchema);

// ====== Routes ======

// Serve homepage with variant assignment
app.get("/",(req,res)=>{
  res.send("welcome home");
});
app.get("/home", async (req, res) => {
  let variant = req.cookies.variant;
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
  res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Simple A/B Test</title>
    <style>
      body {
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        padding: 0;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f0f4ff, #e3e7ff);
      }
      .card {
        background: #fff;
        max-width: 420px;
        width: 100%;
        padding: 2rem;
        border-radius: 16px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
        text-align: center;
        animation: fadeIn 0.8s ease-in-out;
      }
      h1 { margin-top: 0; font-size: 1.8rem; color: #1e293b; }
      p { color: #555; margin-bottom: 1.5rem; }
      button {
        padding: 0.9rem 1.5rem;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-weight: bold;
        font-size: 1rem;
        color: white;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
      }
      #msg { margin-top: 1rem; font-size: 0.95rem; color: #16a34a; font-weight: 500; }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>🚀 Welcome to our Demo!</h1>
      <p>This page is randomly showing CTA variant A or B.</p>
      <button id="cta">Loading...</button>
      <p id="msg"></p>
    </div>

    <script>
      function getCookie(name) {
        const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? match[2] : null;
      }
      const variant = getCookie("variant");
      const cta = document.getElementById("cta");
      if (variant === "A") {
        cta.textContent = "✨ Get Started";
        cta.style.background = "#2563eb";
      } else {
        cta.textContent = "🎉 Start Free";
        cta.style.background = "#10b981";
      }
      cta.addEventListener("click", async () => {
        await fetch("/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "click" }),
          credentials: "include",
        });
        document.getElementById("msg").textContent = "✅ Click recorded!";
      });
    </script>
  </body>
</html>`);
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


export const handler = serverless(app);
