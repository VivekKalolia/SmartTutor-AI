#!/usr/bin/env python3
"""
Train IEKT on XES3G5M dataset.

Usage:
    cd python_backend
    source venv/bin/activate
    python iekt_train.py              # default 5 epochs
    python iekt_train.py --epochs 10  # more epochs
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import roc_auc_score, accuracy_score

from iekt_model import IEKTModel

# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

class XES3G5MDataset(Dataset):
    """Loads XES3G5M question-level sequences into padded tensors."""

    def __init__(self, csv_path: str, max_len: int = 200):
        df = pd.read_csv(csv_path)
        self.max_len = max_len
        self.questions = []
        self.concepts = []
        self.responses = []
        self.masks = []
        self.all_question_ids = set()
        self.all_concept_ids = set()

        has_masks = "selectmasks" in df.columns

        for _, row in df.iterrows():
            q_list = [int(x) for x in str(row["questions"]).split(",")]
            c_raw  = str(row["concepts"]).split(",")
            r_list = [int(x) for x in str(row["responses"]).split(",")]
            m_list = (
                [int(x) for x in str(row["selectmasks"]).split(",")]
                if has_masks
                else [1] * len(q_list)
            )

            # Build valid (non-padding) sequences
            qs, cs, rs = [], [], []
            for q, c, r, m in zip(q_list, c_raw, r_list, m_list):
                if m != 1 or q == -1:
                    continue
                # Multi-concept → take first
                c_id = int(c.strip().split("_")[0])
                qs.append(q)
                cs.append(c_id)
                rs.append(max(0, r))  # clamp to 0/1
                self.all_question_ids.add(q)
                self.all_concept_ids.add(c_id)

            if len(qs) < 3:
                continue  # need at least 3 interactions

            # Truncate and pad
            qs = qs[: max_len]
            cs = cs[: max_len]
            rs = rs[: max_len]
            valid = len(qs)
            pad = max_len - valid
            self.questions.append(qs + [0] * pad)
            self.concepts.append(cs + [0] * pad)
            self.responses.append(rs + [0] * pad)
            self.masks.append([True] * valid + [False] * pad)

        self.questions = torch.tensor(self.questions, dtype=torch.long)
        self.concepts = torch.tensor(self.concepts, dtype=torch.long)
        self.responses = torch.tensor(self.responses, dtype=torch.long)
        self.masks = torch.tensor(self.masks, dtype=torch.bool)

        print(f"  Loaded {len(self)} sequences, "
              f"{len(self.all_question_ids)} unique questions, "
              f"{len(self.all_concept_ids)} unique KCs")

    def __len__(self):
        return len(self.questions)

    def __getitem__(self, idx):
        return (
            self.questions[idx],
            self.concepts[idx],
            self.responses[idx],
            self.masks[idx],
        )


# ---------------------------------------------------------------------------
# Training loop
# ---------------------------------------------------------------------------

def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = 0.0
    all_preds, all_labels = [], []
    n_batches = 0

    for q, c, r, m in loader:
        q, c, r, m = q.to(device), c.to(device), r.to(device), m.to(device)

        preds = model(q, c, r, m)  # (B, T-1)
        target = r[:, 1:].float()  # (B, T-1) – next-step responses
        valid = m[:, 1:]           # (B, T-1)

        loss = criterion(preds[valid], target[valid])
        optimizer.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        total_loss += loss.item()
        n_batches += 1

        p = preds[valid].detach().cpu().numpy()
        t = target[valid].detach().cpu().numpy()
        all_preds.extend(p.tolist())
        all_labels.extend(t.tolist())

    avg_loss = total_loss / max(n_batches, 1)
    auc = roc_auc_score(all_labels, all_preds) if len(set(all_labels)) > 1 else 0.5
    acc = accuracy_score(all_labels, [1 if p > 0.5 else 0 for p in all_preds])
    return avg_loss, auc, acc


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss = 0.0
    all_preds, all_labels = [], []
    n_batches = 0

    for q, c, r, m in loader:
        q, c, r, m = q.to(device), c.to(device), r.to(device), m.to(device)

        preds = model(q, c, r, m)
        target = r[:, 1:].float()
        valid = m[:, 1:]

        loss = criterion(preds[valid], target[valid])
        total_loss += loss.item()
        n_batches += 1

        p = preds[valid].detach().cpu().numpy()
        t = target[valid].detach().cpu().numpy()
        all_preds.extend(p.tolist())
        all_labels.extend(t.tolist())

    avg_loss = total_loss / max(n_batches, 1)
    auc = roc_auc_score(all_labels, all_preds) if len(set(all_labels)) > 1 else 0.5
    acc = accuracy_score(all_labels, [1 if p > 0.5 else 0 for p in all_preds])
    return avg_loss, auc, acc


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Train IEKT on XES3G5M")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--embed-dim", type=int, default=64)
    parser.add_argument("--hidden-dim", type=int, default=128)
    parser.add_argument("--max-len", type=int, default=200)
    parser.add_argument("--val-split", type=float, default=0.15)
    parser.add_argument("--data-dir", type=str,
                        default=os.path.join("..", "data", "XES3G5M", "question_level"))
    parser.add_argument("--output-dir", type=str,
                        default=os.path.join("models", "iekt"))
    args = parser.parse_args()

    device = (
        torch.device("mps") if torch.backends.mps.is_available()
        else torch.device("cuda") if torch.cuda.is_available()
        else torch.device("cpu")
    )
    print(f"Device: {device}")

    # ── Load data ────────────────────────────────────────────────────────
    train_csv = os.path.join(args.data_dir, "train_valid_sequences_quelevel.csv")
    test_csv = os.path.join(args.data_dir, "test_quelevel.csv")

    print("Loading training data...")
    full_ds = XES3G5MDataset(train_csv, max_len=args.max_len)

    # Split into train / val
    n = len(full_ds)
    n_val = int(n * args.val_split)
    n_train = n - n_val
    train_ds, val_ds = torch.utils.data.random_split(
        full_ds, [n_train, n_val], generator=torch.Generator().manual_seed(42)
    )
    print(f"  Train: {n_train}, Val: {n_val}")

    test_ds = None
    if os.path.exists(test_csv):
        print("Loading test data...")
        test_ds = XES3G5MDataset(test_csv, max_len=args.max_len)

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                              num_workers=0, pin_memory=False)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False,
                            num_workers=0, pin_memory=False)
    test_loader = (
        DataLoader(test_ds, batch_size=args.batch_size, shuffle=False,
                   num_workers=0, pin_memory=False)
        if test_ds else None
    )

    # Gather global stats from the full dataset
    num_questions = max(full_ds.all_question_ids) + 1
    num_kcs = max(full_ds.all_concept_ids) + 1
    if test_ds:
        num_questions = max(num_questions, max(test_ds.all_question_ids) + 1)
        num_kcs = max(num_kcs, max(test_ds.all_concept_ids) + 1)

    print(f"  num_questions={num_questions}, num_kcs={num_kcs}")

    # ── Build model ──────────────────────────────────────────────────────
    model = IEKTModel(
        num_questions=num_questions,
        num_kcs=num_kcs,
        embed_dim=args.embed_dim,
        hidden_dim=args.hidden_dim,
        dropout=0.2,
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"  Model parameters: {total_params:,}")

    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=2
    )
    criterion = nn.BCELoss()

    # ── Train ────────────────────────────────────────────────────────────
    best_val_auc = 0.0
    history = []

    Path(args.output_dir).mkdir(parents=True, exist_ok=True)
    model_path = os.path.join(args.output_dir, "iekt_xes3g5m.pt")
    config_path = os.path.join(args.output_dir, "iekt_config.json")

    print(f"\n{'='*60}")
    print(f"Training IEKT for {args.epochs} epochs")
    print(f"{'='*60}\n")

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()

        train_loss, train_auc, train_acc = train_epoch(
            model, train_loader, optimizer, criterion, device
        )
        val_loss, val_auc, val_acc = evaluate(
            model, val_loader, criterion, device
        )
        scheduler.step(val_auc)

        elapsed = time.time() - t0
        history.append({
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "train_auc": round(train_auc, 4),
            "train_acc": round(train_acc, 4),
            "val_loss": round(val_loss, 4),
            "val_auc": round(val_auc, 4),
            "val_acc": round(val_acc, 4),
            "time_s": round(elapsed, 1),
        })

        improved = ""
        if val_auc > best_val_auc:
            best_val_auc = val_auc
            torch.save(model.state_dict(), model_path)
            improved = " ★ saved"

        print(
            f"Epoch {epoch:2d}/{args.epochs} │ "
            f"train loss={train_loss:.4f} auc={train_auc:.4f} acc={train_acc:.4f} │ "
            f"val loss={val_loss:.4f} auc={val_auc:.4f} acc={val_acc:.4f} │ "
            f"{elapsed:.1f}s{improved}"
        )

    # ── Test ─────────────────────────────────────────────────────────────
    test_result = {}
    if test_loader:
        model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
        test_loss, test_auc, test_acc = evaluate(model, test_loader, criterion, device)
        test_result = {
            "test_loss": round(test_loss, 4),
            "test_auc": round(test_auc, 4),
            "test_acc": round(test_acc, 4),
        }
        print(f"\nTest │ loss={test_loss:.4f} auc={test_auc:.4f} acc={test_acc:.4f}")

    # ── Save config ──────────────────────────────────────────────────────
    # Find the 10 most frequent KCs for representative mastery probing
    kc_freq: dict[int, int] = {}
    for seq in full_ds.concepts.tolist():
        for c in seq:
            if c > 0:
                kc_freq[c] = kc_freq.get(c, 0) + 1
    top_kcs = sorted(kc_freq, key=kc_freq.get, reverse=True)[:10]

    config = {
        "num_questions": num_questions,
        "num_kcs": num_kcs,
        "embed_dim": args.embed_dim,
        "hidden_dim": args.hidden_dim,
        "num_layers": 1,
        "dropout": 0.2,
        "max_len": args.max_len,
        "dataset": "XES3G5M",
        "best_val_auc": round(best_val_auc, 4),
        "history": history,
        "top_kcs": top_kcs,
        "mathbench_kc_mapping": {
            "ALGEBRA_GENERAL": top_kcs[0] if len(top_kcs) > 0 else 1,
            "GEOMETRY_SHAPES": top_kcs[1] if len(top_kcs) > 1 else 2,
            "PROBABILITY_STATISTICS": top_kcs[2] if len(top_kcs) > 2 else 3,
            "FUNCTIONS_GRAPHS": top_kcs[3] if len(top_kcs) > 3 else 4,
            "MATH_OTHER": top_kcs[4] if len(top_kcs) > 4 else 5,
        },
        **test_result,
    }

    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)

    print(f"\n✓ Model saved to {model_path}")
    print(f"✓ Config saved to {config_path}")
    print(f"✓ Best val AUC: {best_val_auc:.4f}")


if __name__ == "__main__":
    main()
