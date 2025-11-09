export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export const mathQuestions: Question[] = [
  {
    id: 1,
    question: "What is the derivative of f(x) = x³ + 2x² - 5x + 1?",
    options: [
      "3x² + 4x - 5",
      "3x² + 2x - 5",
      "x² + 4x - 5",
      "3x² + 4x + 1",
    ],
    correctAnswer: 0,
    explanation:
      "Using the power rule, the derivative of x³ is 3x², 2x² is 4x, -5x is -5, and the constant 1 is 0.",
  },
  {
    id: 2,
    question: "Solve for x: 2x + 5 = 13",
    options: ["x = 4", "x = 6", "x = 8", "x = 9"],
    correctAnswer: 0,
    explanation:
      "Subtract 5 from both sides: 2x = 8. Then divide by 2: x = 4.",
  },
  {
    id: 3,
    question: "What is the value of ∫(2x + 3)dx?",
    options: [
      "x² + 3x + C",
      "2x² + 3x + C",
      "x² + 3 + C",
      "2x + 3x + C",
    ],
    correctAnswer: 0,
    explanation:
      "The integral of 2x is x², and the integral of 3 is 3x. Don't forget the constant of integration C.",
  },
  {
    id: 4,
    question: "What is the limit of (x² - 4)/(x - 2) as x approaches 2?",
    options: ["0", "2", "4", "Undefined"],
    correctAnswer: 2,
    explanation:
      "Factor the numerator: (x-2)(x+2)/(x-2) = x+2. As x approaches 2, this equals 4.",
  },
  {
    id: 5,
    question: "What is the slope of the line perpendicular to y = 2x + 3?",
    options: ["2", "-2", "1/2", "-1/2"],
    correctAnswer: 3,
    explanation:
      "The slope of the given line is 2. Perpendicular lines have slopes that are negative reciprocals, so -1/2.",
  },
];

export const scienceQuestions: Question[] = [
  {
    id: 1,
    question:
      "What is the acceleration due to gravity on Earth (approximately)?",
    options: ["9.8 m/s²", "10 m/s²", "8.9 m/s²", "11 m/s²"],
    correctAnswer: 0,
    explanation:
      "The standard acceleration due to gravity on Earth is approximately 9.8 meters per second squared.",
  },
  {
    id: 2,
    question: "What is the chemical formula for water?",
    options: ["H₂O", "CO₂", "O₂", "H₂O₂"],
    correctAnswer: 0,
    explanation:
      "Water consists of two hydrogen atoms and one oxygen atom, giving it the formula H₂O.",
  },
  {
    id: 3,
    question: "What is Newton's Second Law of Motion?",
    options: [
      "F = ma",
      "E = mc²",
      "PV = nRT",
      "V = IR",
    ],
    correctAnswer: 0,
    explanation:
      "Newton's Second Law states that force equals mass times acceleration (F = ma).",
  },
  {
    id: 4,
    question: "What is the pH of a neutral solution?",
    options: ["0", "7", "14", "10"],
    correctAnswer: 1,
    explanation:
      "A neutral solution has a pH of 7. Values below 7 are acidic, and values above 7 are basic.",
  },
  {
    id: 5,
    question: "What is the speed of light in a vacuum?",
    options: [
      "3 × 10⁸ m/s",
      "3 × 10⁶ m/s",
      "3 × 10¹⁰ m/s",
      "3 × 10⁵ m/s",
    ],
    correctAnswer: 0,
    explanation:
      "The speed of light in a vacuum is approximately 3 × 10⁸ meters per second (300,000,000 m/s).",
  },
];

export const aiAssistResponses: Record<string, string> = {
  default:
    "I can help you understand this problem better. Let me break it down step by step.",
  math_derivative:
    "To find the derivative, apply the power rule: for each term xⁿ, the derivative is nxⁿ⁻¹. For constants, the derivative is 0.",
  math_integral:
    "To integrate, reverse the power rule: increase the exponent by 1 and divide by the new exponent. Remember to add the constant of integration.",
  math_limit:
    "When evaluating limits, try factoring or simplifying the expression first. If you get 0/0, use L'Hôpital's rule or algebraic manipulation.",
  science_physics:
    "In physics problems, identify the given quantities, what you're solving for, and which equations relate these quantities. Draw a diagram if helpful.",
  science_chemistry:
    "For chemistry problems, ensure chemical equations are balanced. Pay attention to units and use dimensional analysis to check your work.",
};
