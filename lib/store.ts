import { configureStore } from "@reduxjs/toolkit";
import quizReducer from "@/lib/features/quiz/quizSlice";
import tutorReducer from "@/lib/features/tutor/tutorSlice";

export const store = configureStore({
  reducer: {
    quiz: quizReducer,
    tutor: tutorReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

