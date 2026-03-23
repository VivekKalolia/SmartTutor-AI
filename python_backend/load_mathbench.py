import os
from typing import List, Dict, Any

import pandas as pd


DATA_PATH = os.path.join("mathbench_data", "mathbench_final.csv")


def get_questions_by_difficulty(difficulty: str) -> List[Dict[str, Any]]:
  """
  Returns a list of question dicts filtered by difficulty.

  difficulty: 'easy' | 'medium' | 'hard'

  Expected columns in mathbench_final.csv:
  - question: the MCQ question text
  - options: answer choices (e.g., A/B/C/D)
  - answer: correct answer key
  - level: original MathBench level
  - difficulty: mapped difficulty (easy/medium/hard)
  """
  if not os.path.exists(DATA_PATH):
    raise FileNotFoundError(
      f"{DATA_PATH} not found. Run download_mathbench.py and prepare_mathbench.py first."
    )

  df = pd.read_csv(DATA_PATH)
  filtered = df[df["difficulty"].str.lower() == difficulty.lower()]
  return filtered.to_dict(orient="records")


if __name__ == "__main__":
  for level in ["easy", "medium", "hard"]:
    questions = get_questions_by_difficulty(level)
    print(f"{level.upper()}: {len(questions)} questions")
    if questions:
      print(questions[0])
      print()

