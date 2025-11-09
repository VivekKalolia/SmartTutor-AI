import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface QuizState {
  currentSubject: "math" | "science" | null;
  currentQuestionIndex: number;
  answers: Record<number, string>;
  showAIAssist: boolean;
}

const initialState: QuizState = {
  currentSubject: null,
  currentQuestionIndex: 0,
  answers: {},
  showAIAssist: false,
};

const quizSlice = createSlice({
  name: "quiz",
  initialState,
  reducers: {
    setSubject: (state, action: PayloadAction<"math" | "science" | null>) => {
      state.currentSubject = action.payload;
      state.currentQuestionIndex = 0;
      state.answers = {};
    },
    setQuestionIndex: (state, action: PayloadAction<number>) => {
      state.currentQuestionIndex = action.payload;
    },
    setAnswer: (
      state,
      action: PayloadAction<{ questionIndex: number; answer: string }>
    ) => {
      state.answers[action.payload.questionIndex] = action.payload.answer;
    },
    toggleAIAssist: (state) => {
      state.showAIAssist = !state.showAIAssist;
    },
    resetQuiz: (state) => {
      state.currentQuestionIndex = 0;
      state.answers = {};
    },
  },
});

export const {
  setSubject,
  setQuestionIndex,
  setAnswer,
  toggleAIAssist,
  resetQuiz,
} = quizSlice.actions;
export default quizSlice.reducer;

