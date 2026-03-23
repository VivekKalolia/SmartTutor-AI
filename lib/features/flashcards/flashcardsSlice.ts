import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface FlashcardCard {
  id: number;
  question: string;
  answer: string;
  subject: string;
}

export interface FlashcardChatMessage {
  role: "user" | "assistant";
  content: string;
  replyingTo?: {
    text: string;
  };
}

function defaultGreeting(name?: string | null): string {
  const safeName = (name ?? "").trim() || "Student";
  return `Hi ${safeName}! I can help you create flashcards on any topic. What would you like to study today? Try asking me about topics like Algebra, Photosynthesis, World History, or any subject you're learning!`;
}

export interface FlashcardsFeatureState {
  studentName: string;
  studentGrade: string;
  currentIndex: number;
  isFlipped: boolean;
  flashcards: FlashcardCard[];
  messages: FlashcardChatMessage[];
  input: string;
  selectedModel: string;
  isLoading: boolean;
  loadingPhase: "understanding" | "generating" | null;
  conversationPhase: "understanding" | "ready";
}

const initialState: FlashcardsFeatureState = {
  studentName: "Student",
  studentGrade: "",
  currentIndex: 0,
  isFlipped: false,
  flashcards: [],
  messages: [{ role: "assistant", content: defaultGreeting("Student") }],
  input: "",
  selectedModel: "llama3.1:8b",
  isLoading: false,
  loadingPhase: null,
  conversationPhase: "understanding",
};

const flashcardsSlice = createSlice({
  name: "flashcards",
  initialState,
  reducers: {
    /** Shallow merge; omit keys you don't want to change. */
    patchFlashcards: (
      state,
      action: PayloadAction<Partial<FlashcardsFeatureState>>
    ) => {
      const p = action.payload;
      if (p.studentName !== undefined) state.studentName = p.studentName;
      if (p.studentGrade !== undefined) state.studentGrade = p.studentGrade;
      if (p.currentIndex !== undefined) state.currentIndex = p.currentIndex;
      if (p.isFlipped !== undefined) state.isFlipped = p.isFlipped;
      if (p.flashcards !== undefined) state.flashcards = p.flashcards;
      if (p.messages !== undefined) state.messages = p.messages;
      if (p.input !== undefined) state.input = p.input;
      if (p.selectedModel !== undefined) state.selectedModel = p.selectedModel;
      if (p.isLoading !== undefined) state.isLoading = p.isLoading;
      if (p.loadingPhase !== undefined) state.loadingPhase = p.loadingPhase;
      if (p.conversationPhase !== undefined)
        state.conversationPhase = p.conversationPhase;
    },
    resetFlashcardsSession: () => initialState,
  },
});

export const { patchFlashcards, resetFlashcardsSession } =
  flashcardsSlice.actions;
export default flashcardsSlice.reducer;

export { defaultGreeting as buildFlashcardsGreeting };
