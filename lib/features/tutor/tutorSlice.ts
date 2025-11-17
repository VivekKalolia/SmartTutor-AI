import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  replyingTo?: {
    text: string;
    messageId: string;
  };
}

interface TutorState {
  messages: Message[];
  isLoading: boolean;
}

const initialState: TutorState = {
  messages: [],
  isLoading: false,
};

const tutorSlice = createSlice({
  name: "tutor",
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    clearMessages: (state) => {
      state.messages = [];
    },
  },
});

export const { addMessage, setLoading, clearMessages } = tutorSlice.actions;
export default tutorSlice.reducer;

