"""
IEKT Inference Service

Loads a trained IEKT model (math: XES3G5M, science: SciQ synthetic sequences) and
provides per-student knowledge state tracking. Same API for both variants.
"""

import os
import json
from typing import Dict, List, Optional

import torch

from iekt_model import IEKTModel

_BASE = os.path.dirname(__file__)

_DEFAULT_MATH_MAPPING = {
    "ALGEBRA_GENERAL": 11,
    "GEOMETRY_SHAPES": 55,
    "PROBABILITY_STATISTICS": 18,
    "FUNCTIONS_GRAPHS": 24,
    "MATH_OTHER": 2,
}

_DEFAULT_SCIENCE_MAPPING = {
    "SCIENCE_PHYSICS": 1,
    "SCIENCE_CHEMISTRY": 2,
    "SCIENCE_BIOLOGY": 3,
    "SCIENCE_EARTH_SPACE": 4,
    "SCIENCE_GENERAL": 5,
}


class IEKTInferenceService:
    """Manages per-student IEKT hidden states and mastery predictions."""

    def __init__(self, variant: str = "math"):
        """
        variant: "math" → models/iekt/iekt_xes3g5m.pt
                 "science" → models/iekt_science/iekt_sciq.pt
        """
        self.variant = variant.lower().strip()
        if self.variant not in ("math", "science"):
            self.variant = "math"

        if self.variant == "science":
            self.model_dir = os.path.join(_BASE, "models", "iekt_science")
            self.model_path = os.path.join(self.model_dir, "iekt_sciq.pt")
            self.config_path = os.path.join(self.model_dir, "iekt_config.json")
            self._default_mapping = dict(_DEFAULT_SCIENCE_MAPPING)
        else:
            self.model_dir = os.path.join(_BASE, "models", "iekt")
            self.model_path = os.path.join(self.model_dir, "iekt_xes3g5m.pt")
            self.config_path = os.path.join(self.model_dir, "iekt_config.json")
            self._default_mapping = dict(_DEFAULT_MATH_MAPPING)

        self.model: Optional[IEKTModel] = None
        self.config: dict = {}
        self.kc_mapping: Dict[str, int] = dict(self._default_mapping)
        self.device = torch.device("cpu")
        self.is_loaded = False
        self._students: Dict[str, dict] = {}

        self._load()

    def _load(self):
        if not os.path.exists(self.model_path):
            print(f"[IEKT:{self.variant}] Model not found at {self.model_path} — fallback mode")
            self.kc_mapping = dict(self._default_mapping)
            return

        if not os.path.exists(self.config_path):
            print(f"[IEKT:{self.variant}] Config not found at {self.config_path} — fallback mode")
            self.kc_mapping = dict(self._default_mapping)
            return

        with open(self.config_path) as f:
            self.config = json.load(f)

        self.model = IEKTModel(
            num_questions=self.config["num_questions"],
            num_kcs=self.config["num_kcs"],
            embed_dim=self.config.get("embed_dim", 64),
            hidden_dim=self.config.get("hidden_dim", 128),
            num_layers=self.config.get("num_layers", 1),
            dropout=0.0,
        ).to(self.device)

        state = torch.load(self.model_path, map_location=self.device, weights_only=True)
        self.model.load_state_dict(state)
        self.model.eval()

        self.kc_mapping = self.config.get(
            "mathbench_kc_mapping",
            self.config.get("sciq_kc_mapping", self._default_mapping),
        )
        self.is_loaded = True

        print(
            f"[IEKT:{self.variant}] Loaded — {self.config['num_questions']} questions, "
            f"{self.config['num_kcs']} KCs, val AUC={self.config.get('best_val_auc', '?')}"
        )

    def _clamp_qid(self, q_id: int) -> int:
        nq = int(self.config.get("num_questions", 2))
        # Embeddings: 0..num_questions inclusive in model definition; training uses 1..nq-1 typical
        return max(1, min(int(q_id), max(1, nq - 1)))

    @property
    def num_concepts(self) -> int:
        return self.config.get("num_kcs", 0)

    @property
    def topic_concept_map(self) -> Dict[str, int]:
        return dict(self.kc_mapping)

    def _get_concept_for_topic(self, topic: str) -> int:
        """Map a KC label or free-text topic to a model KC id."""
        upper = topic.upper().replace(" ", "_")
        if upper in self.kc_mapping:
            return self.kc_mapping[upper]

        if self.variant == "science":
            lookup = {
                "physics": "SCIENCE_PHYSICS",
                "chemistry": "SCIENCE_CHEMISTRY",
                "biology": "SCIENCE_BIOLOGY",
                "earth": "SCIENCE_EARTH_SPACE",
                "space": "SCIENCE_EARTH_SPACE",
                "earth_space": "SCIENCE_EARTH_SPACE",
                "earth_&_space": "SCIENCE_EARTH_SPACE",
                "general": "SCIENCE_GENERAL",
                "general_science": "SCIENCE_GENERAL",
                "science": "SCIENCE_GENERAL",
            }
            mapped = lookup.get(topic.lower().replace(" ", "_"), "SCIENCE_GENERAL")
            return self.kc_mapping.get(mapped, self.kc_mapping.get("SCIENCE_GENERAL", 5))

        lookup = {
            "algebra": "ALGEBRA_GENERAL",
            "geometry": "GEOMETRY_SHAPES",
            "probability": "PROBABILITY_STATISTICS",
            "probability_statistics": "PROBABILITY_STATISTICS",
            "statistics": "PROBABILITY_STATISTICS",
            "functions": "FUNCTIONS_GRAPHS",
            "functions_graphs": "FUNCTIONS_GRAPHS",
            "calculus": "FUNCTIONS_GRAPHS",
            "other": "MATH_OTHER",
        }
        mapped = lookup.get(topic.lower(), "MATH_OTHER")
        return self.kc_mapping.get(mapped, self.kc_mapping.get("MATH_OTHER", 2))

    def _get_student(self, student_id: str) -> dict:
        if student_id not in self._students:
            self._students[student_id] = {
                "hidden": self.model.init_hidden(),
                "interactions": [],
                "num_interactions": 0,
            }
        return self._students[student_id]

    def _probe_mastery(self, hidden) -> Dict[str, float]:
        """Probe P(correct) for each KC (same method as math: anchor item id = 1)."""
        mastery = {}
        probe_q = 1
        for kc_label, model_kc_id in self.kc_mapping.items():
            pq = self._clamp_qid(probe_q)
            pkc = int(model_kc_id)
            p = self.model.predict_next(hidden, next_q_id=pq, next_kc_id=pkc)
            mastery[kc_label] = round(p, 4)
        return mastery

    def update_and_predict(
        self,
        student_id: str,
        concept_id: int,
        correct: int,
        question_id: int = 1,
    ) -> dict:
        if not self.is_loaded or self.model is None:
            return self._fallback_response(student_id)

        qid = self._clamp_qid(question_id)
        kc = int(concept_id)

        student = self._get_student(student_id)
        student["hidden"] = self.model.update_state(
            student["hidden"], q_id=qid, kc_id=kc, response=correct
        )
        student["num_interactions"] += 1
        student["interactions"].append(
            {"concept": kc, "correct": correct, "qid": qid}
        )

        mastery = self._probe_mastery(student["hidden"])
        ranked = sorted(mastery.items(), key=lambda kv: kv[1])
        recommended = [kc for kc, _ in ranked[:3]]

        return {
            "mastery_per_topic": mastery,
            "recommended_topics": recommended,
            "overall_mastery": round(
                sum(mastery.values()) / max(len(mastery), 1), 4
            ),
            "num_interactions": student["num_interactions"],
        }

    def predict_from_history(
        self,
        student_id: str,
        interactions: List[dict],
    ) -> dict:
        if not self.is_loaded or self.model is None:
            return self._fallback_response(student_id)

        self._students.pop(student_id, None)
        student = self._get_student(student_id)

        for ix in interactions:
            raw_concept = ix.get("concept", ix.get("topic", "MATH_OTHER"))
            if isinstance(raw_concept, str) and not raw_concept.isdigit():
                concept_id = self._get_concept_for_topic(raw_concept)
            else:
                concept_id = int(raw_concept)

            correct = int(ix.get("correct", 0))
            q_raw = ix.get("qid", ix.get("question_id", 1))
            q_id = self._clamp_qid(int(q_raw) if q_raw is not None else 1)

            student["hidden"] = self.model.update_state(
                student["hidden"], q_id=q_id, kc_id=concept_id, response=correct
            )
            student["num_interactions"] += 1
            student["interactions"].append(ix)

        mastery = self._probe_mastery(student["hidden"])
        ranked = sorted(mastery.items(), key=lambda kv: kv[1])
        recommended = [kc for kc, _ in ranked[:3]]

        return {
            "mastery_per_topic": mastery,
            "recommended_topics": recommended,
            "overall_mastery": round(
                sum(mastery.values()) / max(len(mastery), 1), 4
            ),
            "num_interactions": student["num_interactions"],
        }

    def _fallback_response(self, student_id: str) -> dict:
        return {
            "mastery_per_topic": {kc: 0.5 for kc in self.kc_mapping},
            "recommended_topics": list(self.kc_mapping.keys())[:3],
            "overall_mastery": 0.5,
            "num_interactions": 0,
        }
