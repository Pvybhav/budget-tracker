import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import apiRouter from "./routes.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, "../.env"), override: false });

const app = express();
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI;

const staticPath = path.join(__dirname, "../dist");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(staticPath));
app.use("/api", (req, res, next) => {
  if (
    req.path === "/health" ||
    req.path.startsWith("/auth") ||
    mongoose.connection.readyState === 1
  ) {
    return next();
  }
  res.status(503).json({ error: "Database unavailable" });
});
app.use("/api", apiRouter);

app.get("*", (req, res) => {
  res.sendFile(path.join(staticPath, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(port, () => {
  console.log(`Backend API listening on http://localhost:${port}`);
});
if (!mongoUri) {
  console.error(
    "Missing MONGODB_URI in environment. Copy server/.env.example to server/.env and update the URI.",
  );
} else {
  mongoose
    .connect(mongoUri)
    .then(() => {
      console.log("Connected to MongoDB Atlas");
    })
    .catch((error) => {
      console.error("MongoDB connection failed:", error);
    });
}
