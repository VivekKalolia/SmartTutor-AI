import os
import random
from pathlib import Path
from typing import Dict, List

import pandas as pd
from datasets import load_dataset


SCIENCE_TOPIC_KEYWORDS: Dict[str, List[str]] = {
    "physics": [
        "force",
        "motion",
        "velocity",
        "acceleration",
        "gravity",
        "electric",
        "magnetic",
        "energy",
        "wave",
        "light",
        "radio",
    ],
    "chemistry": [
        "atom",
        "molecule",
        "chemical",
        "reaction",
        "acid",
        "base",
        "ph",
        "ion",
        "bond",
        "metal",
        "oxid",
    ],
    "biology": [
        "cell",
        "organism",
        "gene",
        "dna",
        "enzyme",
        "evolution",
        "ecosystem",
        "plant",
        "animal",
        "respiration",
        "reproduction",
    ],
    "earth_space": [
        "earth",
        "rock",
        "weather",
        "climate",
        "ocean",
        "volcano",
        "plate tectonic",
        "galaxy",
        "sun",
        "solar",
        "atmosphere",
    ],
}


SCIENCE_KC_MAP = {
    "physics": "SCIENCE_PHYSICS",
    "chemistry": "SCIENCE_CHEMISTRY",
    "biology": "SCIENCE_BIOLOGY",
    "earth_space": "SCIENCE_EARTH_SPACE",
    "general_science": "SCIENCE_GENERAL",
}


def infer_science_topic(question: str, support: str) -> str:
    text = f"{question} {support}".lower()
    scores = {topic: 0 for topic in SCIENCE_TOPIC_KEYWORDS}
    for topic, keywords in SCIENCE_TOPIC_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                scores[topic] += 1
    best_topic = max(scores, key=scores.get)
    return best_topic if scores[best_topic] > 0 else "general_science"


def infer_difficulty(question: str, support: str) -> str:
    q_len = len(question.split())
    s_len = len(support.split()) if support else 0
    complexity = q_len + 0.2 * s_len
    if complexity < 18:
        return "easy"
    if complexity < 28:
        return "medium"
    if complexity < 40:
        return "hard"
    return "very_hard"


def main() -> None:
    random.seed(42)
    base_dir = Path(__file__).parent
    out_dir = base_dir / "science_data"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "sciq_final.csv"

    print("[SciQ] Downloading dataset: allenai/sciq")
    ds = load_dataset("allenai/sciq")
    df = pd.concat(
        [
            ds["train"].to_pandas(),
            ds["validation"].to_pandas(),
            ds["test"].to_pandas(),
        ],
        ignore_index=True,
    )
    print(f"[SciQ] Loaded {len(df)} rows")

    records = []
    for _, row in df.iterrows():
        question = str(row.get("question", "")).strip()
        correct = str(row.get("correct_answer", "")).strip()
        distractors = [
            str(row.get("distractor1", "")).strip(),
            str(row.get("distractor2", "")).strip(),
            str(row.get("distractor3", "")).strip(),
        ]
        support = str(row.get("support", "")).strip()

        if not question or not correct or any(not d for d in distractors):
            continue

        options = [correct] + distractors
        random.shuffle(options)
        correct_idx = options.index(correct)
        answer = ["A", "B", "C", "D"][correct_idx]

        topic = infer_science_topic(question, support)
        difficulty = infer_difficulty(question, support)
        kc_id = SCIENCE_KC_MAP.get(topic, "MATH_OTHER")

        records.append(
            {
                "id": f"sciq_{len(records) + 1}",
                "question": question,
                "options": options,
                "answer": answer,
                "topic": topic,
                "difficulty": difficulty,
                "kc_id": kc_id,
                "explanation": support,
            }
        )

    out_df = pd.DataFrame.from_records(records)
    out_df.to_csv(out_path, index=False)

    print(f"[SciQ] Saved {out_path} with {len(out_df)} rows")
    print("[SciQ] Topic distribution:")
    print(out_df["topic"].value_counts())
    print("\n[SciQ] Difficulty distribution:")
    print(out_df["difficulty"].value_counts())


if __name__ == "__main__":
    main()
