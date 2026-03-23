import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { readFileSync } from "fs";
import { join } from "path";
import {
  type AdaptiveQuestion,
  type Difficulty,
  type KcId,
  parseCSVLine,
  parsePythonList,
  answerLetterToIndex,
  formatTopicLabel,
} from "@/lib/adaptive-learning/adaptive-engine";

type QuestionRow = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  topic: string;
  difficulty: Difficulty;
  kc_id: string;
  level?: string;
  q_index: number;
};

let mathCache: QuestionRow[] | null = null;
let scienceCache: QuestionRow[] | null = null;

function formatScienceTopicLabel(raw: string): string {
  if (!raw) return "General Science";
  const map: Record<string, string> = {
    physics: "Physics",
    chemistry: "Chemistry",
    biology: "Biology",
    earth_space: "Earth & Space",
    general_science: "General Science",
  };
  return map[raw.toLowerCase()] || raw;
}

function loadMathBench(): QuestionRow[] {
  if (mathCache) return mathCache;

  const csvPath = join(
    process.cwd(),
    "python_backend",
    "mathbench_data",
    "mathbench_final.csv"
  );

  const raw = readFileSync(csvPath, "utf-8");
  const logicalRows: string[] = [];
  let current = "";
  let openQuotes = false;

  for (const line of raw.split("\n")) {
    if (!openQuotes) {
      current = line;
    } else {
      current += "\n" + line;
    }
    let q = 0;
    for (let i = 0; i < current.length; i++) {
      if (current[i] === '"') {
        if (i + 1 < current.length && current[i + 1] === '"') {
          i++;
        } else {
          q++;
        }
      }
    }
    openQuotes = q % 2 !== 0;
    if (!openQuotes) {
      logicalRows.push(current);
      current = "";
    }
  }
  if (current.trim()) logicalRows.push(current);

  const questions: QuestionRow[] = [];
  for (let i = 1; i < logicalRows.length; i++) {
    const row = logicalRows[i].trim();
    if (!row) continue;
    const f = parseCSVLine(row);
    if (f.length < 7) continue;

    const [questionText, optionsStr, answer, level, topic, difficulty, kc_id] =
      f;
    const rawOptions = parsePythonList(optionsStr);
    if (rawOptions.length < 2) continue;
    const options = rawOptions.map((o) => o.replace(/\\\\/g, "\\"));
    const correctAnswer = answerLetterToIndex(answer);

    questions.push({
      id: `mb_${i}`,
      question: questionText,
      options,
      correctAnswer,
      explanation: `The correct answer is ${answer}: ${options[correctAnswer] ?? answer}.`,
      topic: formatTopicLabel(topic),
      difficulty: difficulty as Difficulty,
      kc_id: (kc_id || "MATH_OTHER") as KcId,
      level,
      q_index: i,
    });
  }

  mathCache = questions;
  return questions;
}

function loadSciQ(): QuestionRow[] {
  if (scienceCache) return scienceCache;

  const csvPath = join(
    process.cwd(),
    "python_backend",
    "science_data",
    "sciq_final.csv"
  );

  const raw = readFileSync(csvPath, "utf-8");
  const logicalRows: string[] = [];
  let current = "";
  let openQuotes = false;

  for (const line of raw.split("\n")) {
    if (!openQuotes) {
      current = line;
    } else {
      current += "\n" + line;
    }
    let q = 0;
    for (let i = 0; i < current.length; i++) {
      if (current[i] === '"') {
        if (i + 1 < current.length && current[i + 1] === '"') {
          i++;
        } else {
          q++;
        }
      }
    }
    openQuotes = q % 2 !== 0;
    if (!openQuotes) {
      logicalRows.push(current);
      current = "";
    }
  }
  if (current.trim()) logicalRows.push(current);

  const questions: QuestionRow[] = [];
  for (let i = 1; i < logicalRows.length; i++) {
    const row = logicalRows[i].trim();
    if (!row) continue;
    const f = parseCSVLine(row);
    if (f.length < 7) continue;

    const [
      id,
      questionText,
      optionsStr,
      answer,
      topic,
      difficulty,
      kc_id,
      explanation,
    ] = f;

    const rawOptions = parsePythonList(optionsStr);
    if (rawOptions.length < 2) continue;
    const options = rawOptions.map((o) => o.replace(/\\\\/g, "\\"));
    const correctAnswer = answerLetterToIndex(answer);

    questions.push({
      id: id || `sciq_${i}`,
      question: questionText,
      options,
      correctAnswer,
      explanation:
        explanation ||
        `The correct answer is ${answer}: ${options[correctAnswer] ?? answer}.`,
      topic: formatScienceTopicLabel(topic),
      difficulty: (difficulty as Difficulty) || "medium",
      kc_id: kc_id || "SCIENCE_GENERAL",
      level: "sciq",
      q_index: i,
    });
  }

  scienceCache = questions;
  return questions;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = (searchParams.get("subject") || "math").toLowerCase();
    const topic = searchParams.get("topic");
    const difficulty = searchParams.get("difficulty");
    const kcId = searchParams.get("kc_id");
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;

    const pool =
      subject === "science" ? loadSciQ() : loadMathBench();

    let filtered = pool;
    if (topic) {
      filtered = filtered.filter(
        (q) => q.topic.toLowerCase() === topic.toLowerCase()
      );
    }
    if (difficulty) {
      filtered = filtered.filter(
        (q) => q.difficulty === difficulty.toLowerCase()
      );
    }
    if (kcId) {
      filtered = filtered.filter((q) => q.kc_id === kcId);
    }
    if (limit && Number.isFinite(limit) && limit > 0) {
      filtered = filtered.slice(0, limit);
    }

    const out: AdaptiveQuestion[] = filtered.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      topic: q.topic,
      difficulty: q.difficulty,
      kc_id: q.kc_id,
      level: q.level,
      q_index: q.q_index,
    }));

    return NextResponse.json({
      questions: out,
      total: pool.length,
      filtered: out.length,
      subject,
    });
  } catch (e) {
    console.error("[Adaptive questions]", e);
    return NextResponse.json(
      {
        error: "Failed to load questions",
        detail: String(e),
        questions: [],
        total: 0,
        filtered: 0,
      },
      { status: 500 }
    );
  }
}
