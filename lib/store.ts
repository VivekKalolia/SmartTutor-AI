import { configureStore } from "@reduxjs/toolkit";
import quizReducer from "@/lib/features/quiz/quizSlice";
import tutorReducer from "@/lib/features/tutor/tutorSlice";
import adaptiveLearningReducer from "@/lib/features/adaptive-learning/adaptiveSlice";

export const store = configureStore({
  reducer: {
    quiz: quizReducer,
    tutor: tutorReducer,
    adaptiveLearning: adaptiveLearningReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
