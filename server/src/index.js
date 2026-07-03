import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import groupRoutes from "./routes/groups.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/splitwise_mvp";

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigin = process.env.CLIENT_URL || "http://127.0.0.1:5173";
      const isLocalDev = !origin || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);

      if (origin === allowedOrigin || isLocalDev) {
        callback(null, true);
        return;
      }

      callback(new Error("This frontend origin is not allowed by CORS."));
    },
  }),
);
app.use(express.json({ limit: "6mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "splitwise-server" });
});

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || "Something went wrong",
  });
});

mongoose
  .connect(mongoUri)
  .then(() => {
    app.listen(port, () => {
      console.log(`API running on http://127.0.0.1:${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
