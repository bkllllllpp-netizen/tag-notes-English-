import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { config } from "./config.js";
import { router as apiRouter } from "./routes/index.js";

const app = express();

app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || !config.corsOrigin.length || config.corsOrigin.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin not allowed by CORS"));
      }
    }
  })
);
app.use(
  morgan("tiny", {
    skip: () => process.env.NODE_ENV === "test"
  })
);

app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api", apiRouter);

app.use((err, req, res, next) => {
  console.error("[error]", err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

app.listen(config.port, () => {
  console.log(`[server] listening on port ${config.port}`);
});
