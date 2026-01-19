import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

const router = express.Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/* ---------------- RETRY ---------------- */
async function generateWithRetry(prompt, retries = 2) {
  try {
    return await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
  } catch (err) {
    if (err.status === 503 && retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return generateWithRetry(prompt, retries - 1);
    }
    throw err;
  }
}

/* ---------------- TEXT EXTRACTION ---------------- */
function extractText(result) {
  if (
    result?.candidates &&
    result.candidates.length > 0 &&
    result.candidates[0]?.content?.parts
  ) {
    return result.candidates[0].content.parts
      .map((p) => p.text)
      .join("")
      .trim();
  }
  return null;
}

/* ---------------- HELPERS ---------------- */
function formatAnswer(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeJSONParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ---------------- STAR PARSER ---------------- */
function parseSTAR(text) {
  const star = { situation: "", task: "", action: "", result: "" };
  let currentKey = null;

  const lines = text.replace(/\*\*/g, "").split("\n");

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    if (/^situation:/i.test(t)) {
      currentKey = "situation";
      star.situation = t.replace(/^situation:/i, "").trim();
    } else if (/^task:/i.test(t)) {
      currentKey = "task";
      star.task = t.replace(/^task:/i, "").trim();
    } else if (/^action:/i.test(t)) {
      currentKey = "action";
      star.action = t.replace(/^action:/i, "").trim();
    } else if (/^result:/i.test(t)) {
      currentKey = "result";
      star.result = t.replace(/^result:/i, "").trim();
    } else if (currentKey) {
      star[currentKey] += " " + t;
    }
  }

  return star;
}

/* ---------------- PROMPT BUILDER ---------------- */
function buildPrompt(type, question) {
  if (type === "dsa") {
    return `
Respond ONLY in valid JSON.
Do NOT include markdown or explanations outside JSON.

Required JSON format:
{
  "type": "dsa",
  "explanation": {
    "approach": "string",
    "algorithm": ["step 1", "step 2"],
    "edgeCases": ["case 1", "case 2"]
  },
  "code": {
    "language": "javascript",
    "content": "string"
  },
  "complexity": {
    "time": "string",
    "space": "string"
  }
}

Problem:
${question}
`;
  }

  if (type === "sql") {
    return `
Respond ONLY in valid JSON.

Required JSON format:
{
  "type": "sql",
  "query": "string",
  "explanation": "string",
  "complexity": "string"
}

Problem:
${question}
`;
  }

  if (type === "tech") {
    return `
You are a technical interviewer.
Explain the concept clearly and concisely.
Use simple language and examples if helpful.

Question:
${question}
`;
  }

  // behavioral (default)
  return `
You are an interview coach.
Always respond using the STAR method in plain text.

Question:
${question}
`;
}

/* ---------------- ROUTE ---------------- */
router.post("/ask", async (req, res) => {
  try {
    const { question, type = "behavioral" } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Invalid question" });
    }

    const prompt = buildPrompt(type, question);
    const result = await generateWithRetry(prompt);

    const rawText = extractText(result);

    if (!rawText) {
      return res.status(503).json({ error: "AI response empty" });
    }

    // ---- DSA / SQL (structured JSON) ----
    if (type === "dsa" || type === "sql") {
      const parsed = safeJSONParse(rawText);

      if (parsed) {
        return res.json({
          ...parsed,
          rawAnswer: rawText,
        });
      }

      return res.json({
        type,
        rawAnswer: rawText,
      });
    }

    // ---- TECH (plain explanation) ----
    if (type === "tech") {
      return res.json({
        answer: formatAnswer(rawText),
      });
    }

    // ---- BEHAVIORAL ----
    const formatted = formatAnswer(rawText);
    return res.json({
      answer: formatted,
      structured: parseSTAR(formatted),
    });

  } catch (err) {
    console.error("Gemini API Error:", err);

    if (err.status === 503) {
      return res.status(503).json({
        error: "AI model busy. Try again shortly.",
      });
    }

    res.status(500).json({ error: "Failed to fetch response" });
  }
});

export default router;
