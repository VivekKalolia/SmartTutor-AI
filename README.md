# SmartTutor AI

An offline-first AI-powered educational application built for secondary school students. SmartTutor AI combines a RAG-grounded chatbot, adaptive quiz system, AI flashcard generation, and multimodal input — all running locally via Ollama without requiring an internet connection.

Built as a final-year project for BSc Computer Science (Machine Learning and AI) at Goldsmiths, University of London.

**Source code:** https://github.com/VivekKalolia/SmartTutor-AI

---

## Features

- **AI Tutor** — Conversational chatbot grounded in teacher-uploaded curriculum PDFs via RAG (Retrieval-Augmented Generation). Supports voice input, image queries, and multi-model switching.
- **Smart Quiz** — Adaptive quiz module for Mathematics and Science. Uses a trained IEKT (Item-Enhanced Knowledge Tracing) model to adjust question difficulty based on per-student knowledge state.
- **AI Flashcards** — Generates study flashcards from uploaded documents or free-form topics using the local LLM.
- **Teacher Dashboard** — Separate teacher role with document upload, student analytics, and AI-generated class insights.
- **Multi-model support** — Switch between six locally-served models: Llama 3.1 8B, Phi-3 Mini, DeepSeek R1 32B, Qwen 2.5 32B, Llama 3.2 Vision 11B, and WizardMath.
- **Multimodal input** — Voice transcription via Whisper and image understanding via the vision model.
- **Text-to-speech** — AI responses read aloud using the Kokoro TTS engine with browser fallback.
- **Offline-first** — No external API calls. Everything runs on the local machine.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| State | Redux Toolkit |
| Database | SQLite via better-sqlite3 |
| LLM inference | Ollama (local) |
| Speech-to-text | Whisper (via Python backend) |
| Text-to-speech | Kokoro ONNX (via Python backend) |
| Knowledge tracing | IEKT model (PyTorch, Python backend) |
| PDF processing | MuPDF.js + Python/pdfplumber |

---

## Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **Ollama** installed and running — [ollama.com](https://ollama.com)
- At least one model pulled, e.g. `ollama pull llama3.1`

---

## Getting Started

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Set up the Python backend

```bash
cd python_backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

The Python backend runs on `http://localhost:8000` and handles Whisper transcription, Kokoro TTS, and IEKT knowledge tracing.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for production

```bash
npm run build
npm start
```

---

## Project Structure

```
├── app/                          # Next.js app directory
│   ├── page.tsx                  # Student dashboard
│   ├── tutor/                    # AI Tutor chat interface
│   ├── quiz/                     # Smart Quiz
│   ├── flashcards/               # AI Flashcard generator
│   ├── teacher/                  # Teacher dashboard and tools
│   └── api/                      # API route handlers
├── components/                   # Shared React components
│   ├── ui/                       # shadcn/ui primitives
│   └── ...                       # Feature components
├── lib/                          # Utilities, hooks, and state
│   ├── features/                 # Redux slices
│   ├── adaptive-learning/        # IEKT question selection logic
│   ├── quiz-feedback/            # Session feedback generation
│   ├── rag/                      # RAG database helpers
│   ├── hooks/                    # Custom React hooks (Whisper, TTS, etc.)
│   └── store.ts                  # Redux store
└── python_backend/               # Flask server for AI services
    ├── server.py                 # Main backend entry point
    ├── iekt_model.py             # IEKT knowledge tracing model
    ├── iekt_inference.py         # Inference helpers
    ├── requirements.txt          # Python dependencies
    └── models/                   # Trained model weights (not in repo)
```

---

## Notes on large model files

The trained model weights (`kokoro-v1.0.onnx`, Whisper `.pt` files) are not included in this repository due to GitHub's file size limits. Download them separately and place them in `python_backend/models/` as documented in the backend README.

---

## Academic context

This project was developed as the final-year project for CM3070-01 Final Project (2025/6), BSc Computer Science (Machine Learning and Artificial Intelligence), Goldsmiths, University of London.
