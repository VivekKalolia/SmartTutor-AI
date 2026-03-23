import os
from pathlib import Path
from typing import List, Dict, Any

import pandas as pd


DIFFICULTY_MAP = {
  "arithmetic": "easy",
  "primary": "easy",
  "middle": "medium",
  "high": "hard",
  "college": "very_hard",
}


def map_mathbench_topic(raw: str) -> str:
  """
  Map verbose MathBench topic strings to a small set of canonical topics.
  Examples of raw topics:
  - 'Middle--Basic Numbers and Algebra--Real Numbers'
  - 'Middle--Basic Probability and Statistics--Data Analysis'
  - 'Middle--Basic Geometry--Basic Concepts of Geometry'
  """
  if not raw:
    return "other"
  lower = raw.lower()

  if "geometry" in lower:
    return "geometry"
  if "probability and statistics" in lower or "probability" in lower or "statistics" in lower:
    return "probability_statistics"
  if "numbers and algebra" in lower or "algebra" in lower:
    return "algebra"
  if "functions" in lower:
    return "functions"
  if "number theory" in lower:
    return "number_theory"
  if "measurement" in lower:
    return "measurement"
  if "arithmetic" in lower:
    return "arithmetic"

  return "other"


def load_mathbench_v1_questions(root: Path) -> pd.DataFrame:
  """
  Load English questions from mathbench_v1 release and return a DataFrame
  with columns: question, options, answer, level.
  """
  records: List[Dict[str, Any]] = []

  def load_jsonl(path: Path, level: str) -> None:
    if not path.exists():
      return
    with path.open("r", encoding="utf-8") as f:
      for line in f:
        line = line.strip()
        if not line:
          continue
        obj = pd.read_json(pd.io.common.StringIO(line), typ="series")
        q = str(obj.get("question", "")).strip()
        options = obj.get("options", [])
        ans = str(obj.get("answer", "")).strip()
        topic = str(obj.get("topic", "")).strip()
        # Normalize options to a list of strings
        if isinstance(options, str):
          try:
            options = eval(options)
          except Exception:
            options = [options]
        records.append(
          {
            "question": q,
            "options": options,
            "answer": ans,
            "level": level,
            # Keep the raw topic only for mapping; we will output a simplified
            # topic label as the final `topic` column.
            "raw_topic": topic,
          }
        )

  # IMPORTANT: Only include multiple-choice questions (single_choice).
  # We skip cloze-style questions since they are not MCQ.

  # Middle, High, College application single-choice (English)
  load_jsonl(root / "middle" / "single_choice_en.jsonl", "middle")
  load_jsonl(root / "high" / "single_choice_en.jsonl", "high")
  load_jsonl(root / "college" / "single_choice_en.jsonl", "college")

  # Knowledge splits for theory questions (all MC single-choice)
  load_jsonl(root / "primary_knowledge" / "single_choice_en.jsonl", "primary")
  load_jsonl(root / "middle_knowledge" / "single_choice_en.jsonl", "middle")
  load_jsonl(root / "high_knowledge" / "single_choice_en.jsonl", "high")
  load_jsonl(root / "college_knowledge" / "single_choice_en.jsonl", "college")

  if not records:
    raise SystemExit("No questions loaded from mathbench_v1 release; check paths.")

  return pd.DataFrame.from_records(records)


def main() -> None:
  """
  Build mathbench_final.csv by combining:
  - Full MathBench-v1 application/theory questions (English only)
  - Optional LiveMathBench AMC_en questions from Hugging Face

  Output schema:
  question, options, answer, level, difficulty
  """
  base_dir = Path(__file__).parent
  release_root = base_dir / "mathbench_v1" / "mathbench_v1"

  # 1) Core MathBench-v1 questions
  df = load_mathbench_v1_questions(release_root)

  # Keep only true multiple-choice questions: options must be a non-empty list
  df = df[df["options"].apply(lambda opts: isinstance(opts, list) and len(opts) > 0)]

  # Add simplified topic labels for adaptive learning and reporting
  df["topic"] = df["raw_topic"].apply(map_mathbench_topic)
  df = df.drop(columns=["raw_topic"])

  # Map difficulty via level and drop any unmapped (e.g., college)
  df["difficulty"] = df["level"].astype(str).str.lower().map(DIFFICULTY_MAP)
  df = df[df["difficulty"].notna()]

  out_path = base_dir / "mathbench_data" / "mathbench_final.csv"
  df.to_csv(out_path, index=False)
  print(f"\nSaved {out_path} with {len(df)} questions")
  print(df["difficulty"].value_counts())


if __name__ == "__main__":
  main()

