from datasets import load_dataset
import pandas as pd
import os


def main() -> None:
  """
  Download the MathBench dataset from Hugging Face and
  save each split as a CSV file under mathbench_data/.

  Note: the original instructions referenced `opencompass/mathbench`
  with `trust_remote_code=True`, but that dataset is no longer
  accessible in the current `datasets` version. We instead use the
  maintained `opencompass/LiveMathBench` dataset, which exposes
  standard splits without remote code.
  """
  os.makedirs("mathbench_data", exist_ok=True)

  # For SmartTutor we focus on English questions. The LiveMathBench page
  # documents multiple configs; here we start with the AMC English split.
  configs = ["v202412_AMC_en"]

  for config in configs:
    print(f"\n=== Loading LiveMathBench config: {config} ===")
    dataset = load_dataset("opencompass/LiveMathBench", config)
    print("Available splits:", dataset.keys())

    for split in dataset.keys():
      df = pd.DataFrame(dataset[split])
      print(f"\n{config} / {split} — columns: {df.columns.tolist()}")
      print(df.head(2))
      filename = f"{config}_{split}.csv"
      out_path = os.path.join("mathbench_data", filename)
      df.to_csv(out_path, index=False)
      print(f"Saved {out_path} ({len(df)} rows)")


if __name__ == "__main__":
  main()

