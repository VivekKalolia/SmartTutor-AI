import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface MessageSource {
  index: number;
  documentName: string;
  content: string;
  score?: number;
  pageNumber?: number;
}

export interface MessagePageImage {
  index: number;
  documentName: string;
  pageNumber: number;
  imageIndex?: number;
  caption: string;
  imageBase64: string;
  mime?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  imageUrl?: string;
  sources?: MessageSource[];
  pageImages?: MessagePageImage[];
  imageDescription?: string;
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
    updateMessage: (
      state,
      action: PayloadAction<{
        id: string;
        content: string;
        sources?: MessageSource[];
        pageImages?: MessagePageImage[];
        imageDescription?: string;
      }>
    ) => {
      const message = state.messages.find((m) => m.id === action.payload.id);
      if (message) {
        message.content = action.payload.content;
        if (action.payload.sources !== undefined) {
          message.sources = action.payload.sources;
        }
        if (action.payload.pageImages !== undefined) {
          message.pageImages = action.payload.pageImages;
        }
        if (action.payload.imageDescription !== undefined) {
          message.imageDescription = action.payload.imageDescription;
        }
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    clearMessages: (state) => {
      state.messages = [];
    },
  },
});

export const { addMessage, updateMessage, setLoading, clearMessages } =
  tutorSlice.actions;
export default tutorSlice.reducer;

