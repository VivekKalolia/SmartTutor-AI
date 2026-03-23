import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Interaction {
  qid: number;
  concept: string | number;
  correct: 0 | 1;
  timestamp: number;
}

export interface KnowledgeState {
  student_id: string;
  mastery_per_kc: Record<string, number>;
  recommended_kcs: string[];
  overall_mastery: number;
  num_interactions: number;
}

interface AdaptiveLearningState {
  currentStudentId: string | null;
  interactionHistory: Interaction[];
  knowledgeState: KnowledgeState | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: AdaptiveLearningState = {
  currentStudentId: null,
  interactionHistory: [],
  knowledgeState: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
};

const adaptiveSlice = createSlice({
  name: "adaptiveLearning",
  initialState,
  reducers: {
    setStudentId: (state, action: PayloadAction<string>) => {
      state.currentStudentId = action.payload;
      // Reset history when student changes
      state.interactionHistory = [];
      state.knowledgeState = null;
    },
    addInteraction: (state, action: PayloadAction<Interaction>) => {
      state.interactionHistory.push({
        ...action.payload,
        timestamp: action.payload.timestamp || Date.now(),
      });
    },
    setKnowledgeState: (state, action: PayloadAction<KnowledgeState>) => {
      state.knowledgeState = action.payload;
      state.lastUpdated = Date.now();
      state.isLoading = false;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearHistory: (state) => {
      state.interactionHistory = [];
      state.knowledgeState = null;
      state.lastUpdated = null;
    },
    resetAdaptiveLearning: (state) => {
      return initialState;
    },
  },
});

export const {
  setStudentId,
  addInteraction,
  setKnowledgeState,
  setLoading,
  setError,
  clearHistory,
  resetAdaptiveLearning,
} = adaptiveSlice.actions;

export default adaptiveSlice.reducer;










