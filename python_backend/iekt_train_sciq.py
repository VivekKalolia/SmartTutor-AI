#!/usr/bin/env python3
"""
Train IEKT on synthetic SciQ interaction sequences (same training loop as XES3G5M).

Usage:
    cd python_backend
    source venv/bin/activate
    python prepare_sciq_kt_sequences.py   # if not already generated
    python iekt_train_sciq.py             # default 5 epochs
    python iekt_train_sciq.py --epochs 10
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from iekt_model import IEKTModel

# Re-use dataset logic from math trainer
from iekt_train import XES3G5MDataset, train_epoch, evaluate


SCIENCE_KC_MAPPING = {
    "SCIENCE_PHYSICS": 1,
    "SCIENCE_CHEMISTRY": 2,
    "SCIENCE_BIOLOGY": 3,
    "SCIENCE_EARTH_SPACE": 4,
    "SCIENCE_GENERAL": 5,
}


def main():
    parser = argparse.ArgumentParser(description="Train IEKT on SciQ synthetic sequences")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--embed-dim", type=int, default=64)
    parser.add_argument("--hidden-dim", type=int, default=128)
    parser.add_argument("--max-len", type=int, default=120)
    parser.add_argument("--val-split", type=float, default=0.15)
    parser.add_argument(
        "--data-csv",
        type=str,
        default=os.path.join("science_data", "sciq_kt_sequences.csv"),
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=os.path.join("models", "iekt_science"),
    )
    args = parser.parse_args()

    device = (
        torch.device("mps")
        if torch.backends.mps.is_available()
        else torch.device("cuda")
        if torch.cuda.is_available()
        else torch.device("cpu")
    )
    print(f"Device: {device}")

    base = os.path.dirname(__file__)
    csv_path = args.data_csv if os.path.isabs(args.data_csv) else os.path.join(base, args.data_csv)
    if not os.path.isfile(csv_path):
        print(f"Missing {csv_path}. Run: python prepare_sciq_kt_sequences.py")
        sys.exit(1)

    print("Loading SciQ KT sequences...")
    full_ds = XES3G5MDataset(csv_path, max_len=args.max_len)

    n = len(full_ds)
    n_val = int(n * args.val_split)
    n_train = n - n_val
    train_ds, val_ds = torch.utils.data.random_split(
        full_ds, [n_train, n_val], generator=torch.Generator().manual_seed(42)
    )
    print(f"  Train: {n_train}, Val: {n_val}")

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
        pin_memory=False,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=False,
    )

    num_questions = max(full_ds.all_question_ids) + 1
    num_kcs = max(full_ds.all_concept_ids) + 1
    print(f"  num_questions={num_questions}, num_kcs={num_kcs}")

    model = IEKTModel(
        num_questions=num_questions,
        num_kcs=num_kcs,
        embed_dim=args.embed_dim,
        hidden_dim=args.hidden_dim,
        dropout=0.2,
    ).to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=2
    )
    criterion = nn.BCELoss()

    best_val_auc = 0.0
    history = []

    out_dir = args.output_dir if os.path.isabs(args.output_dir) else os.path.join(base, args.output_dir)
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    model_path = os.path.join(out_dir, "iekt_sciq.pt")
    config_path = os.path.join(out_dir, "iekt_config.json")

    print(f"\n{'='*60}")
    print(f"Training SciQ IEKT for {args.epochs} epochs")
    print(f"{'='*60}\n")

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        train_loss, train_auc, train_acc = train_epoch(
            model, train_loader, optimizer, criterion, device
        )
        val_loss, val_auc, val_acc = evaluate(model, val_loader, criterion, device)
        scheduler.step(val_auc)

        elapsed = time.time() - t0
        history.append(
            {
                "epoch": epoch,
                "train_loss": round(train_loss, 4),
                "train_auc": round(train_auc, 4),
                "train_acc": round(train_acc, 4),
                "val_loss": round(val_loss, 4),
                "val_auc": round(val_auc, 4),
                "val_acc": round(val_acc, 4),
                "time_s": round(elapsed, 1),
            }
        )

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

    config = {
        "num_questions": num_questions,
        "num_kcs": num_kcs,
        "embed_dim": args.embed_dim,
        "hidden_dim": args.hidden_dim,
        "num_layers": 1,
        "dropout": 0.2,
        "max_len": args.max_len,
        "dataset": "SciQ_synthetic_KT",
        "best_val_auc": round(best_val_auc, 4),
        "history": history,
        "sciq_kc_mapping": SCIENCE_KC_MAPPING,
        "mathbench_kc_mapping": SCIENCE_KC_MAPPING,
    }

    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)

    print(f"\n✓ Model saved to {model_path}")
    print(f"✓ Config saved to {config_path}")
    print(f"✓ Best val AUC: {best_val_auc:.4f}")


if __name__ == "__main__":
    main()
