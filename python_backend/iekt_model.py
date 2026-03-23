"""
Item-Enhanced Knowledge Tracing (IEKT) Model

Enhances standard DKT by incorporating both knowledge component (KC) embeddings
AND individual question (item) embeddings, allowing the model to differentiate
between questions within the same KC and capture item-specific difficulty.

Architecture:
    Interaction  →  [Q_emb ∥ KC_emb ∥ R_emb]  →  Encoder  →  GRU  →  Predictor
    at time t                                                         ↓
                                                              P(correct at t+1)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class IEKTModel(nn.Module):

    def __init__(
        self,
        num_questions: int,
        num_kcs: int,
        embed_dim: int = 64,
        hidden_dim: int = 128,
        num_layers: int = 1,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.num_questions = num_questions
        self.num_kcs = num_kcs
        self.embed_dim = embed_dim
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers

        self.question_embed = nn.Embedding(num_questions + 1, embed_dim, padding_idx=0)
        self.kc_embed = nn.Embedding(num_kcs + 1, embed_dim, padding_idx=0)
        self.response_embed = nn.Embedding(2, embed_dim)

        self.interaction_encoder = nn.Sequential(
            nn.Linear(embed_dim * 3, embed_dim * 2),
            nn.ReLU(),
            nn.Dropout(dropout),
        )

        self.gru = nn.GRU(
            input_size=embed_dim * 2,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
        )

        self.predictor = nn.Sequential(
            nn.Linear(hidden_dim + embed_dim * 2, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, 1),
        )

    # ------------------------------------------------------------------
    # Training forward: process full sequences
    # ------------------------------------------------------------------
    def forward(self, question_ids, kc_ids, responses, mask=None):
        """
        Args:
            question_ids : (B, T) int   – question IDs per timestep
            kc_ids       : (B, T) int   – KC IDs per timestep
            responses    : (B, T) int   – 0/1 correct per timestep
            mask         : (B, T) bool  – True for valid positions

        Returns:
            preds : (B, T-1) float – P(correct) for positions 1..T-1
                    (predicting each next step from the previous state)
        """
        q_emb = self.question_embed(question_ids)
        kc_emb = self.kc_embed(kc_ids)
        r_emb = self.response_embed(responses)

        interaction = self.interaction_encoder(
            torch.cat([q_emb, kc_emb, r_emb], dim=-1)
        )

        gru_out, _ = self.gru(interaction)  # (B, T, H)

        # Predict position t+1 using hidden state at t and target q/kc at t+1
        h = gru_out[:, :-1, :]                            # (B, T-1, H)
        tgt_q = self.question_embed(question_ids[:, 1:])   # (B, T-1, E)
        tgt_kc = self.kc_embed(kc_ids[:, 1:])              # (B, T-1, E)
        combined = torch.cat([h, tgt_q, tgt_kc], dim=-1)   # (B, T-1, H+2E)

        logits = self.predictor(combined).squeeze(-1)       # (B, T-1)
        return torch.sigmoid(logits)

    # ------------------------------------------------------------------
    # Inference: single-step updates for live quiz sessions
    # ------------------------------------------------------------------
    def init_hidden(self, batch_size=1):
        device = next(self.parameters()).device
        return torch.zeros(self.num_layers, batch_size, self.hidden_dim, device=device)

    @torch.no_grad()
    def predict_next(self, hidden, next_q_id, next_kc_id):
        """Predict P(correct) for a new question *without* updating state."""
        device = next(self.parameters()).device
        h_last = hidden[-1:].transpose(0, 1)  # (1, 1, H)

        tgt_q = self.question_embed(torch.tensor([[next_q_id]], device=device))
        tgt_kc = self.kc_embed(torch.tensor([[next_kc_id]], device=device))
        combined = torch.cat([h_last, tgt_q, tgt_kc], dim=-1)

        logit = self.predictor(combined).squeeze()
        return torch.sigmoid(logit).item()

    @torch.no_grad()
    def update_state(self, hidden, q_id, kc_id, response):
        """Feed one interaction and return updated hidden state."""
        device = next(self.parameters()).device

        q_emb = self.question_embed(torch.tensor([[q_id]], device=device))
        kc_emb = self.kc_embed(torch.tensor([[kc_id]], device=device))
        r_emb = self.response_embed(torch.tensor([[response]], device=device))

        interaction = self.interaction_encoder(
            torch.cat([q_emb, kc_emb, r_emb], dim=-1)
        )
        _, new_hidden = self.gru(interaction, hidden)
        return new_hidden
