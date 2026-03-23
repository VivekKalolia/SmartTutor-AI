#!/usr/bin/env python3
"""
Build synthetic interaction sequences from SciQ for IEKT training.

SciQ has no real student response logs; we sample sequences of (question, KC, response)
where correctness is drawn from a difficulty-informed Bernoulli model. This matches the
math pipeline structurally: same CSV columns as XES3G5M question-level files
(questions, concepts, responses, selectmasks).

Usage:
    cd python_backend && source venv/bin/activate
    python prepare_sciq_kt_sequences.py
"""

import os
import argparse
import pandas as pd
import numpy as np

# KC string in CSV -> integer concept id (1..5), aligned with iekt_train_sciq / inference
KC_TO_INT = {
    "SCIENCE_PHYSICS": 1,
    "SCIENCE_CHEMISTRY": 2,
    "SCIENCE_BIOLOGY": 3,
    "SCIENCE_EARTH_SPACE": 4,
    "SCIENCE_GENERAL": 5,
}

DIFF_P = {
    "easy": 0.78,
    "medium": 0.66,
    "hard": 0.56,
    "very_hard": 0.46,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default=os.path.join("science_data", "sciq_final.csv"),
        help="Path to sciq_final.csv",
    )
    parser.add_argument(
        "--output",
        default=os.path.join("science_data", "sciq_kt_sequences.csv"),
        help="Output CSV path",
    )
    parser.add_argument("--num-sequences", type=int, default=55_000)
    parser.add_argument("--min-len", type=int, default=12)
    parser.add_argument("--max-len", type=int, default=100)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    base = os.path.dirname(__file__)
    in_path = args.input if os.path.isabs(args.input) else os.path.join(base, args.input)
    out_path = args.output if os.path.isabs(args.output) else os.path.join(base, args.output)

    df = pd.read_csv(in_path)
    # Stable 1-based question ids = row order in sciq_final (matches API q_index)
    df["q_index"] = np.arange(1, len(df) + 1, dtype=np.int64)

    def kc_int(row):
        k = str(row.get("kc_id", "SCIENCE_GENERAL") or "SCIENCE_GENERAL").strip()
        return KC_TO_INT.get(k, 5)

    df["kc_int"] = df.apply(kc_int, axis=1)

    rng = np.random.default_rng(args.seed)
    n = len(df)
    rows_out = []

    for _ in range(args.num_sequences):
        length = int(rng.integers(args.min_len, args.max_len + 1))
        idxs = rng.integers(0, n, size=length)
        sub = df.iloc[idxs]
        qs = sub["q_index"].astype(int).tolist()
        cs = sub["kc_int"].astype(int).tolist()
        rs = []
        for _, r in sub.iterrows():
            diff = str(r.get("difficulty", "medium") or "medium").lower()
            p = DIFF_P.get(diff, 0.62)
            rs.append(int(rng.random() < p))

        rows_out.append(
            {
                "questions": ",".join(str(x) for x in qs),
                "concepts": ",".join(str(x) for x in cs),
                "responses": ",".join(str(x) for x in rs),
                "selectmasks": ",".join("1" for _ in rs),
            }
        )

    out_df = pd.DataFrame(rows_out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    out_df.to_csv(out_path, index=False)
    print(f"Wrote {len(out_df)} sequences to {out_path}")


if __name__ == "__main__":
    main()
