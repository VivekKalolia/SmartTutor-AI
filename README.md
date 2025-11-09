# SmartTutor AI

A professional, university-level front-end UI for SmartTutor AI, emphasizing clarity, academic trust, and seamless integration of advanced learning features.

## Features

- **Dashboard**: Academic-style landing with overview cards, learning progress, deadlines, and assignment snapshots
- **Smart Quiz**: Adaptive quiz module for Math and Science with progress tracking and feedback
- **AI Tutor**: Full-featured chat interface for academic assistance
- **AI Assist**: Context-aware help feature within quizzes

## Tech Stack

- **Framework**: Next.js 14 (React)
- **Styling**: TailwindCSS with Shadcn UI components
- **State Management**: Redux Toolkit
- **TypeScript**: Full type safety
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── page.tsx           # Dashboard page
│   ├── quiz/              # Smart Quiz section
│   ├── tutor/             # AI Tutor section
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Shadcn UI components
│   ├── navigation.tsx    # Main navigation
│   └── layout.tsx        # Page layout wrapper
├── lib/                  # Utilities and state
│   ├── features/        # Redux slices
│   ├── demo-data.ts     # Static demo data
│   └── store.ts          # Redux store configuration
└── public/               # Static assets
```

## Design Principles

- **Academic Trust**: Clean, professional design suitable for university-level use
- **Violet-Academic Theme**: Consistent violet accents with neutral backgrounds
- **Accessibility**: WCAG 2.1 AA compliant with ARIA attributes
- **Responsive**: Fully responsive across all device sizes
- **Performance**: Optimized for fast rendering and smooth operation

## License

This project is created for academic purposes.

