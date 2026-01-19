import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import aiRoutes from "./routes/ai.js";

// ✅ Force correct .env loading
dotenv.config({ path: "./.env" });

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/ai", aiRoutes);

app.get("/", (req, res) => {
  res.send("AI Interview Helper Backend Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
