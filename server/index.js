import fs from "fs";
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

export const app = express();
const configuredPort = Number(process.env.PORT) || 4000;
const mongoUri = process.env.MONGODB_URI;
const isProduction = process.env.NODE_ENV === "production";
// Keeps local dev writes out of the production database even when both share the same
// Atlas cluster/URI; override with MONGODB_DB_NAME if a specific name is needed.
const mongoDbName =
  process.env.MONGODB_DB_NAME || (isProduction ? "budget_tracker" : "budget_tracker_dev");

const staticPath = path.join(__dirname, "../dist");
const hasFrontendBuild = fs.existsSync(path.join(staticPath, "index.html"));
// In production only allow explicitly configured origins (the frontend is served from
// this same origin, so this only matters for cross-origin API access). In development,
// reflect any origin so the Vite dev server (different port) can reach the API.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: isProduction ? allowedOrigins : true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
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

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }
  if (!hasFrontendBuild) {
    return res.status(404).json({
      error: "Frontend build not found. Run npm run build from the project root.",
    });
  }
  res.sendFile(path.join(staticPath, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const startServer = (portToListen) => {
  const server = app.listen(portToListen, () => {
    console.log(`Backend API listening on http://localhost:${portToListen}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      const nextPort = portToListen + 1;
      console.warn(`Port ${portToListen} is busy; retrying on ${nextPort}.`);
      startServer(nextPort);
      return;
    }

    console.error("Server failed to start:", error);
    process.exit(1);
  });
};

startServer(configuredPort);

if (!mongoUri) {
  console.error(
    "Missing MONGODB_URI in environment. Copy server/.env.example to server/.env and update the URI.",
  );
} else {
  mongoose
    .connect(mongoUri, { dbName: mongoDbName })
    .then(() => {
      console.log(`Connected to MongoDB Atlas (db: ${mongoDbName})`);
    })
    .catch((error) => {
      console.error("MongoDB connection failed:", error);
    });
}

// Handle uncaught errors
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});
