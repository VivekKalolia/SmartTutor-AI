"use client";

import { useState, useRef, useEffect } from "react";
import TeacherLayout from "@/components/teacher-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Brain,
  Plus,
  X,
  Calculator,
  Atom,
  Trash2,
  Upload,
  Image as ImageIcon,
  ChevronDown,
  ExternalLink,
  FunctionSquare,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { mathQuestions, scienceQuestions } from "@/lib/demo-data";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Dynamically import React Quill to avoid SSR issues
const ReactQuill = dynamic(
  async () => {
    const { default: RQ } = await import("react-quill");
    // @ts-ignore
    return { default: RQ };
  },
  { ssr: false }
);

interface Question {
  id: string;
  subject: "math" | "science";
  topic: string;
  question: string;
  questionType: "multiple-choice" | "open-ended";
  options?: string[];
  correctAnswer?: number | null;
  imageUrl?: string;
}

const mathTopics = ["Algebra", "Calculus", "Geometry", "Statistics"];
const scienceTopics = ["Physics", "Chemistry", "Biology", "Earth Science"];

// Convert demo questions to our Question format
const initialMathQuestions: Question[] = mathQuestions.map((q, idx) => ({
  id: `math-${q.id}`,
  subject: "math",
  topic: mathTopics[idx % mathTopics.length],
  question: q.question,
  questionType: "multiple-choice",
  options: q.options,
  correctAnswer: q.correctAnswer,
}));

const initialScienceQuestions: Question[] = scienceQuestions.map((q, idx) => ({
  id: `science-${q.id}`,
  subject: "science",
  topic: scienceTopics[idx % scienceTopics.length],
  question: q.question,
  questionType: "multiple-choice",
  options: q.options,
  correctAnswer: q.correctAnswer,
}));

export default function TeacherQuestions() {
  const [questions, setQuestions] = useState<Question[]>([
    ...initialMathQuestions,
    ...initialScienceQuestions,
  ]);
  const [subject, setSubject] = useState<"math" | "science" | "">("");
  const [topic, setTopic] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [questionType, setQuestionType] = useState<
    "multiple-choice" | "open-ended"
  >("multiple-choice");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [mathDialogOpen, setMathDialogOpen] = useState(false);
  const [mathInput, setMathInput] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [questionToEdit, setQuestionToEdit] = useState<Question | null>(null);
  const [hasLatexInQuestion, setHasLatexInQuestion] = useState(false);
  const router = useRouter();

  // Load Quill CSS
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://cdn.quilljs.com/1.3.6/quill.snow.css";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, []);

  // Render math preview
  useEffect(() => {
    if (typeof window !== "undefined") {
      const previewEl = document.getElementById("math-preview");
      if (previewEl) {
        if (mathInput.trim()) {
          try {
            previewEl.innerHTML = "";
            katex.render(mathInput, previewEl, {
              throwOnError: false,
              displayMode: false,
            });
          } catch (e) {
            previewEl.innerHTML =
              '<span class="text-destructive">Invalid LaTeX</span>';
          }
        } else {
          previewEl.innerHTML = "";
        }
      }
    }
  }, [mathInput]);

  // Add Shadcn tooltips to Quill toolbar buttons
  useEffect(() => {
    if (typeof window !== "undefined") {
      const addTooltips = () => {
        const tooltipMap: Array<{ selector: string; tooltip: string }> = [
          { selector: "button.ql-bold", tooltip: "Bold (Ctrl+B)" },
          { selector: "button.ql-italic", tooltip: "Italic (Ctrl+I)" },
          { selector: "button.ql-underline", tooltip: "Underline (Ctrl+U)" },
          { selector: "button.ql-strike", tooltip: "Strikethrough" },
          { selector: "button.ql-header", tooltip: "Heading" },
          {
            selector: 'button.ql-list[value="ordered"]',
            tooltip: "Numbered List",
          },
          {
            selector: 'button.ql-list[value="bullet"]',
            tooltip: "Bullet List",
          },
          { selector: 'button.ql-script[value="sub"]', tooltip: "Subscript" },
          {
            selector: 'button.ql-script[value="super"]',
            tooltip: "Superscript",
          },
          {
            selector: 'button.ql-indent[value="-1"]',
            tooltip: "Decrease Indent",
          },
          {
            selector: 'button.ql-indent[value="+1"]',
            tooltip: "Increase Indent",
          },
          { selector: "button.ql-link", tooltip: "Insert Link" },
          { selector: "button.ql-clean", tooltip: "Clear Formatting" },
        ];

        tooltipMap.forEach(({ selector, tooltip }) => {
          const buttons = document.querySelectorAll(`.ql-toolbar ${selector}`);
          buttons.forEach((button) => {
            // Skip if already processed
            if ((button as HTMLElement).dataset.tooltipAdded) return;

            // Mark as processed
            (button as HTMLElement).dataset.tooltipAdded = "true";

            // Create a React root for this button and wrap it with Tooltip
            // Since we can't easily inject React components into Quill's DOM,
            // we'll use a custom tooltip implementation with Shadcn styling
            const originalTitle = button.getAttribute("title") || tooltip;
            button.setAttribute("data-tooltip", tooltip);
            button.setAttribute("title", ""); // Remove default tooltip

            // Add custom tooltip on hover using Shadcn-like styling
            let tooltipElement: HTMLElement | null = null;

            const showTooltip = (e: Event) => {
              if (tooltipElement) return;

              const target = e.currentTarget as HTMLElement;
              tooltipElement = document.createElement("div");
              tooltipElement.className =
                "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95";
              tooltipElement.textContent = tooltip;
              tooltipElement.style.position = "fixed";
              tooltipElement.style.pointerEvents = "none";
              document.body.appendChild(tooltipElement);

              const rect = target.getBoundingClientRect();
              tooltipElement.style.top = `${rect.bottom + window.scrollY + 4}px`;
              tooltipElement.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
              tooltipElement.style.transform = "translateX(-50%)";
            };

            const hideTooltip = () => {
              if (tooltipElement) {
                tooltipElement.remove();
                tooltipElement = null;
              }
            };

            const updateTooltipPosition = (e: Event) => {
              if (tooltipElement) {
                const target = e.currentTarget as HTMLElement;
                const rect = target.getBoundingClientRect();
                tooltipElement.style.top = `${rect.bottom + window.scrollY + 4}px`;
                tooltipElement.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
              }
            };

            button.addEventListener("mouseenter", showTooltip);
            button.addEventListener("mouseleave", hideTooltip);
            button.addEventListener("mousemove", updateTooltipPosition);
          });
        });
      };

      const timer = setTimeout(addTooltips, 300);
      const observer = new MutationObserver(() => {
        setTimeout(addTooltips, 100);
      });

      const toolbars = document.querySelectorAll(".ql-toolbar");
      toolbars.forEach((toolbar) => {
        observer.observe(toolbar, { childList: true, subtree: true });
      });

      return () => {
        clearTimeout(timer);
        observer.disconnect();
        // Clean up tooltips
        document.querySelectorAll("[data-tooltip]").forEach((btn) => {
          btn.removeEventListener("mouseenter", () => {});
          btn.removeEventListener("mouseleave", () => {});
        });
      };
    }
  }, [question, editDialogOpen]);

  // Check for LaTeX and render question preview
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check if question contains LaTeX
      const latexPattern = /\$([^$]+)\$|\\\(([^\)]+)\\\)/g;
      const hasLatex = question ? latexPattern.test(question) : false;
      setHasLatexInQuestion(hasLatex);

      if (hasLatex && question) {
        const previewEl = document.getElementById("question-preview");
        const editPreviewEl = document.getElementById("edit-question-preview");
        const targetEl = previewEl || editPreviewEl;

        if (targetEl) {
          try {
            // Process the question HTML to find and render LaTeX
            let processedHtml = question;

            // Reset regex
            latexPattern.lastIndex = 0;
            const replacements: Array<{
              original: string;
              rendered: string;
              index: number;
            }> = [];
            let match;

            // Collect all matches
            while ((match = latexPattern.exec(question)) !== null) {
              const latex = match[1] || match[2] || "";
              try {
                const mathEl = document.createElement("span");
                katex.render(latex, mathEl, {
                  throwOnError: false,
                  displayMode: false,
                });
                replacements.push({
                  original: match[0],
                  rendered: mathEl.outerHTML,
                  index: match.index,
                });
              } catch (e) {
                // Keep original if rendering fails
              }
            }

            // Replace in reverse order to maintain indices
            for (let i = replacements.length - 1; i >= 0; i--) {
              processedHtml =
                processedHtml.substring(0, replacements[i].index) +
                replacements[i].rendered +
                processedHtml.substring(
                  replacements[i].index + replacements[i].original.length
                );
            }

            targetEl.innerHTML = processedHtml || "";
          } catch (e) {
            if (targetEl) {
              targetEl.innerHTML = question;
            }
          }
        }
      } else {
        // Clear preview if no LaTeX
        const previewEl = document.getElementById("question-preview");
        const editPreviewEl = document.getElementById("edit-question-preview");
        if (previewEl) previewEl.innerHTML = "";
        if (editPreviewEl) editPreviewEl.innerHTML = "";
      }
    }
  }, [question]);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      if (correctAnswer === index) {
        setCorrectAnswer(null);
      } else if (correctAnswer !== null && correctAnswer > index) {
        setCorrectAnswer(correctAnswer - 1);
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleInsertMath = () => {
    if (!mathInput.trim()) {
      toast.error("Please enter a math expression");
      return;
    }
    // Insert LaTeX math into Quill editor as HTML
    // We'll use a wrapper div to find the Quill instance
    const quillEditor = document.querySelector(".ql-editor") as any;
    if (quillEditor && quillEditor.__quill) {
      const quill = quillEditor.__quill;
      let range = quill.getSelection(true);
      if (!range) {
        range = { index: quill.getLength(), length: 0 };
      }
      // Create a span with data attribute for LaTeX
      try {
        const mathEl = document.createElement("span");
        katex.render(mathInput, mathEl, {
          throwOnError: false,
          displayMode: false,
        });
        quill.clipboard.dangerouslyPasteHTML(range.index, mathEl.outerHTML);
        quill.setSelection(range.index + 1);
      } catch (e) {
        // Fallback: insert as plain text with LaTeX markers
        quill.insertText(range.index, `$${mathInput}$`, "user");
      }
    } else {
      // Fallback: append to question state directly
      setQuestion((prev) => prev + ` $${mathInput}$ `);
    }
    setMathInput("");
    setMathDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!subject) {
      toast.error("Please select a subject");
      return;
    }
    if (!topic) {
      toast.error("Please select a topic");
      return;
    }
    if (!question.trim()) {
      toast.error("Please enter a question");
      return;
    }
    if (questionType === "multiple-choice") {
      if (options.some((opt) => !opt.trim())) {
        toast.error("Please fill in all options");
        return;
      }
      if (correctAnswer === null) {
        toast.error("Please select the correct answer");
        return;
      }
    }

    const newQuestion: Question = {
      id: Date.now().toString(),
      subject: subject as "math" | "science",
      topic: topic,
      question: question.trim(),
      questionType,
      ...(questionType === "multiple-choice" && {
        options: options.map((opt) => opt.trim()),
        correctAnswer,
      }),
      ...(imagePreview && { imageUrl: imagePreview }),
    };

    setQuestions([...questions, newQuestion]);
    toast.success("Question added successfully!");

    // Reset form
    setSubject("");
    setTopic("");
    setQuestion("");
    setQuestionType("multiple-choice");
    setOptions(["", "", "", ""]);
    setCorrectAnswer(null);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteClick = (id: string) => {
    setQuestionToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (questionToDelete) {
      setQuestions(questions.filter((q) => q.id !== questionToDelete));
      toast.success("Question deleted");
      setDeleteDialogOpen(false);
      setQuestionToDelete(null);
    }
  };

  const handleEditClick = (question: Question) => {
    setQuestionToEdit(question);
    setSubject(question.subject);
    setTopic(question.topic);
    setQuestion(question.question);
    setQuestionType(question.questionType);
    setOptions(question.options || ["", "", "", ""]);
    setCorrectAnswer(question.correctAnswer ?? null);
    setImagePreview(question.imageUrl || null);
    setEditDialogOpen(true);
  };

  const handleUpdateQuestion = () => {
    if (!questionToEdit) return;

    if (!subject) {
      toast.error("Please select a subject");
      return;
    }
    if (!topic) {
      toast.error("Please select a topic");
      return;
    }
    if (!question.trim()) {
      toast.error("Please enter a question");
      return;
    }
    if (questionType === "multiple-choice") {
      if (options.some((opt) => !opt.trim())) {
        toast.error("Please fill in all options");
        return;
      }
      if (correctAnswer === null) {
        toast.error("Please select the correct answer");
        return;
      }
    }

    const updatedQuestion: Question = {
      ...questionToEdit,
      subject: subject as "math" | "science",
      topic: topic,
      question: question.trim(),
      questionType,
      ...(questionType === "multiple-choice" && {
        options: options.map((opt) => opt.trim()),
        correctAnswer,
      }),
      ...(imagePreview && { imageUrl: imagePreview }),
    };

    setQuestions(
      questions.map((q) => (q.id === questionToEdit.id ? updatedQuestion : q))
    );
    toast.success("Question updated successfully!");
    setEditDialogOpen(false);
    setQuestionToEdit(null);

    // Reset form
    setSubject("");
    setTopic("");
    setQuestion("");
    setQuestionType("multiple-choice");
    setOptions(["", "", "", ""]);
    setCorrectAnswer(null);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const mathQuestionsList = questions.filter((q) => q.subject === "math");
  const scienceQuestionsList = questions.filter((q) => q.subject === "science");

  const DISPLAY_LIMIT = 3;
  const displayedMathQuestions = mathQuestionsList.slice(0, DISPLAY_LIMIT);
  const displayedScienceQuestions = scienceQuestionsList.slice(
    0,
    DISPLAY_LIMIT
  );

  return (
    <TeacherLayout>
      <div className="flex justify-center">
        <div className="w-full max-w-4xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Question Bank</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage quiz questions for Math and Science subjects
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Add New Question
              </CardTitle>
              <CardDescription>
                Fill in the details below to create a new quiz question
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Select
                  value={subject}
                  onValueChange={(value) => {
                    setSubject(value as "math" | "science");
                    setTopic(""); // Reset topic when subject changes
                  }}
                >
                  <SelectTrigger id="subject">
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="math">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-[#1E3A8A]" />
                        <span>Math</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="science">
                      <div className="flex items-center gap-2">
                        <Atom className="h-4 w-4 text-[#059669]" />
                        <span>Science</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {subject && (
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic</Label>
                  <div className="space-y-2">
                    <Input
                      id="topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Type or select a topic"
                      list={`topic-list-${subject}`}
                    />
                    <datalist id={`topic-list-${subject}`}>
                      {(subject === "math" ? mathTopics : scienceTopics).map(
                        (t) => (
                          <option key={t} value={t} />
                        )
                      )}
                    </datalist>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="question">Question</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMathDialogOpen(true)}
                    className="gap-2"
                    style={{ cursor: "pointer" }}
                  >
                    <FunctionSquare className="h-4 w-4" />
                    Insert Math
                  </Button>
                </div>
                <div className="border rounded-md [&_.ql-container]:min-h-[150px] [&_.ql-container]:max-h-[300px] [&_.ql-container_ql-editor]:min-h-[150px] [&_.ql-container_ql-editor]:max-h-[300px] [&_.ql-container]:!border-0 [&_.ql-toolbar]:!border-b">
                  <ReactQuill
                    theme="snow"
                    value={question}
                    onChange={setQuestion}
                    placeholder="Enter the question text... Use the toolbar to format text, add bold, italics, etc."
                    modules={{
                      toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        ["bold", "italic", "underline", "strike"],
                        [{ list: "ordered" }, { list: "bullet" }],
                        [{ script: "sub" }, { script: "super" }],
                        [{ indent: "-1" }, { indent: "+1" }],
                        ["link"],
                        ["clean"],
                      ],
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Tip: Use the toolbar above to format your question. Click
                  &quot;Insert Math&quot; to add mathematical expressions.
                </p>
              </div>

              {hasLatexInQuestion && question && (
                <div className="space-y-2">
                  <Label>Question Preview</Label>
                  <div className="border rounded-lg p-4 bg-muted/50 min-h-[80px]">
                    <div
                      id="question-preview"
                      className="prose prose-sm max-w-none dark:prose-invert"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="image-upload">Question Image (Optional)</Label>
                {imagePreview ? (
                  <div className="relative border rounded-lg p-4">
                    <div className="relative inline-block">
                      <img
                        src={imagePreview}
                        alt="Question preview"
                        className="max-h-64 rounded-md"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={handleRemoveImage}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        style={{ cursor: "pointer" }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Upload an image to accompany the question
                    </p>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      asChild
                      className="gap-2"
                      style={{ cursor: "pointer" }}
                    >
                      <label
                        htmlFor="image-upload"
                        style={{ cursor: "pointer" }}
                      >
                        <Upload className="h-4 w-4" />
                        Choose Image
                      </label>
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="question-type">Question Type</Label>
                    <p className="text-sm text-muted-foreground">
                      {questionType === "multiple-choice"
                        ? "Students select from multiple options"
                        : "Students provide a written answer"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label
                      htmlFor="question-type"
                      className="text-sm font-normal"
                    >
                      {questionType === "multiple-choice"
                        ? "Multiple Choice"
                        : "Open-Ended"}
                    </Label>
                    <Switch
                      id="question-type"
                      checked={questionType === "open-ended"}
                      onCheckedChange={(checked) =>
                        setQuestionType(
                          checked ? "open-ended" : "multiple-choice"
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              {questionType === "multiple-choice" && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Answer Options</Label>
                      {options.length < 6 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddOption}
                          className="gap-2"
                          style={{ cursor: "pointer" }}
                        >
                          <Plus className="h-4 w-4" />
                          Add Option
                        </Button>
                      )}
                    </div>
                    {options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="w-8 h-8 flex items-center justify-center"
                          >
                            {String.fromCharCode(65 + index)}
                          </Badge>
                          <Input
                            placeholder={`Option ${index + 1}`}
                            value={option}
                            onChange={(e) =>
                              handleOptionChange(index, e.target.value)
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveOption(index)}
                          disabled={options.length <= 2}
                          className="h-8 w-8"
                          style={{
                            cursor:
                              options.length <= 2 ? "not-allowed" : "pointer",
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="correct-answer">Correct Answer</Label>
                    <Select
                      value={
                        correctAnswer !== null ? correctAnswer.toString() : ""
                      }
                      onValueChange={(value) =>
                        setCorrectAnswer(parseInt(value))
                      }
                    >
                      <SelectTrigger id="correct-answer">
                        <SelectValue placeholder="Select the correct answer" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((_, index) => (
                          <SelectItem key={index} value={index.toString()}>
                            {String.fromCharCode(65 + index)}:{" "}
                            {options[index] || `Option ${index + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Button
                onClick={handleSubmit}
                className="w-full"
                style={{ cursor: "pointer" }}
              >
                Add Question
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calculator className="h-4 w-4 text-[#1E3A8A]" />
                      Math Questions ({mathQuestionsList.length})
                    </CardTitle>
                    <CardDescription>
                      {mathQuestionsList.length === 0
                        ? "No math questions added yet"
                        : `${mathQuestionsList.length} question${mathQuestionsList.length !== 1 ? "s" : ""} available`}
                    </CardDescription>
                  </div>
                  {mathQuestionsList.length > DISPLAY_LIMIT && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/teacher/questions/math")}
                      className="gap-2"
                      style={{ cursor: "pointer" }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      View All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {mathQuestionsList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No math questions yet. Add your first question above.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedMathQuestions.map((q) => (
                      <div
                        key={q.id}
                        className="p-4 border rounded-lg space-y-3 min-h-[200px] max-h-[300px] flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-2 flex-1 min-h-0">
                          <div className="flex-1 space-y-2 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant="outline" className="text-xs">
                                {q.questionType === "multiple-choice"
                                  ? "Multiple Choice"
                                  : "Open-Ended"}
                              </Badge>
                              {q.topic && (
                                <Badge variant="secondary" className="text-xs">
                                  {q.topic}
                                </Badge>
                              )}
                            </div>
                            <div
                              className="prose prose-sm max-w-none dark:prose-invert overflow-y-auto max-h-[120px]"
                              dangerouslySetInnerHTML={{ __html: q.question }}
                            />
                            {q.imageUrl && (
                              <img
                                src={q.imageUrl}
                                alt="Question"
                                className="max-h-32 rounded-md border"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditClick(q)}
                              className="h-8 w-8 flex-shrink-0"
                              style={{ cursor: "pointer" }}
                            >
                              <Pencil className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(q.id)}
                              className="h-8 w-8 flex-shrink-0"
                              style={{ cursor: "pointer" }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {q.questionType === "multiple-choice" &&
                          q.correctAnswer !== undefined &&
                          q.correctAnswer !== null &&
                          q.options &&
                          q.options[q.correctAnswer] && (
                            <div className="text-sm text-muted-foreground pt-2 border-t">
                              <p>
                                Correct Answer:{" "}
                                <span className="font-medium text-foreground">
                                  {q.options[q.correctAnswer]}
                                </span>
                              </p>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Atom className="h-4 w-4 text-[#059669]" />
                      Science Questions ({scienceQuestionsList.length})
                    </CardTitle>
                    <CardDescription>
                      {scienceQuestionsList.length === 0
                        ? "No science questions added yet"
                        : `${scienceQuestionsList.length} question${scienceQuestionsList.length !== 1 ? "s" : ""} available`}
                    </CardDescription>
                  </div>
                  {scienceQuestionsList.length > DISPLAY_LIMIT && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/teacher/questions/science")}
                      className="gap-2"
                      style={{ cursor: "pointer" }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      View All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {scienceQuestionsList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No science questions yet. Add your first question above.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedScienceQuestions.map((q) => (
                      <div
                        key={q.id}
                        className="p-4 border rounded-lg space-y-3 min-h-[200px] max-h-[300px] flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-2 flex-1 min-h-0">
                          <div className="flex-1 space-y-2 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant="outline" className="text-xs">
                                {q.questionType === "multiple-choice"
                                  ? "Multiple Choice"
                                  : "Open-Ended"}
                              </Badge>
                              {q.topic && (
                                <Badge variant="secondary" className="text-xs">
                                  {q.topic}
                                </Badge>
                              )}
                            </div>
                            <div
                              className="prose prose-sm max-w-none dark:prose-invert overflow-y-auto max-h-[120px]"
                              dangerouslySetInnerHTML={{ __html: q.question }}
                            />
                            {q.imageUrl && (
                              <img
                                src={q.imageUrl}
                                alt="Question"
                                className="max-h-32 rounded-md border"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditClick(q)}
                              className="h-8 w-8 flex-shrink-0"
                              style={{ cursor: "pointer" }}
                            >
                              <Pencil className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(q.id)}
                              className="h-8 w-8 flex-shrink-0"
                              style={{ cursor: "pointer" }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {q.questionType === "multiple-choice" &&
                          q.correctAnswer !== undefined &&
                          q.correctAnswer !== null &&
                          q.options &&
                          q.options[q.correctAnswer] && (
                            <div className="text-sm text-muted-foreground pt-2 border-t">
                              <p>
                                Correct Answer:{" "}
                                <span className="font-medium text-foreground">
                                  {q.options[q.correctAnswer]}
                                </span>
                              </p>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <AlertDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Question</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this question? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setQuestionToDelete(null)}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteConfirm}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={mathDialogOpen} onOpenChange={setMathDialogOpen}>
            <AlertDialogContent className="max-w-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <FunctionSquare className="h-5 w-5" />
                  Insert Math Expression
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Enter a LaTeX math expression. Examples:{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    {"\\frac{a}{b}"}
                  </code>
                  ,{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    x^2 + y^2
                  </code>
                  ,{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    {"\\int_0^1 f(x)dx"}
                  </code>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="math-input">LaTeX Expression</Label>
                  <Input
                    id="math-input"
                    value={mathInput}
                    onChange={(e) => setMathInput(e.target.value)}
                    placeholder="e.g., \frac{a}{b} or x^2 + y^2"
                    className="font-mono"
                  />
                </div>
                {mathInput && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <p className="text-sm font-medium mb-2">Preview:</p>
                    <div className="text-lg" id="math-preview"></div>
                  </div>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setMathInput("");
                    setMathDialogOpen(false);
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleInsertMath}>
                  Insert
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Pencil className="h-5 w-5" />
                  Edit Question
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Update the question details below
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-subject">Subject</Label>
                  <Select
                    value={subject}
                    onValueChange={(value) => {
                      setSubject(value as "math" | "science");
                      setTopic("");
                    }}
                  >
                    <SelectTrigger id="edit-subject">
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="math">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-[#1E3A8A]" />
                          <span>Math</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="science">
                        <div className="flex items-center gap-2">
                          <Atom className="h-4 w-4 text-[#059669]" />
                          <span>Science</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {subject && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-topic">Topic</Label>
                    <div className="space-y-2">
                      <Input
                        id="edit-topic"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Type or select a topic"
                        list={`edit-topic-list-${subject}`}
                      />
                      <datalist id={`edit-topic-list-${subject}`}>
                        {(subject === "math" ? mathTopics : scienceTopics).map(
                          (t) => (
                            <option key={t} value={t} />
                          )
                        )}
                      </datalist>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-question">Question</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMathDialogOpen(true)}
                      className="gap-2"
                      style={{ cursor: "pointer" }}
                    >
                      <FunctionSquare className="h-4 w-4" />
                      Insert Math
                    </Button>
                  </div>
                  <TooltipProvider>
                    <div className="border rounded-md [&_.ql-container]:min-h-[150px] [&_.ql-container]:max-h-[300px] [&_.ql-container_ql-editor]:min-h-[150px] [&_.ql-container_ql-editor]:max-h-[300px] [&_.ql-container]:!border-0 [&_.ql-toolbar]:!border-b [&_[data-tooltip-wrapper]]:relative">
                      <ReactQuill
                        theme="snow"
                        value={question}
                        onChange={setQuestion}
                        placeholder="Enter the question text..."
                        modules={{
                          toolbar: [
                            [{ header: [1, 2, 3, false] }],
                            ["bold", "italic", "underline", "strike"],
                            [{ list: "ordered" }, { list: "bullet" }],
                            [{ script: "sub" }, { script: "super" }],
                            [{ indent: "-1" }, { indent: "+1" }],
                            ["link"],
                            ["clean"],
                          ],
                        }}
                      />
                    </div>
                  </TooltipProvider>
                </div>

                {hasLatexInQuestion && question && (
                  <div className="space-y-2">
                    <Label>Question Preview</Label>
                    <div className="border rounded-lg p-4 bg-muted/50 min-h-[80px]">
                      <div
                        id="edit-question-preview"
                        className="prose prose-sm max-w-none dark:prose-invert"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="edit-image-upload">
                    Question Image (Optional)
                  </Label>
                  {imagePreview ? (
                    <div className="relative border rounded-lg p-4">
                      <div className="relative inline-block">
                        <img
                          src={imagePreview}
                          alt="Question preview"
                          className="max-h-64 rounded-md"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={handleRemoveImage}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          style={{ cursor: "pointer" }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground mb-3">
                        Upload an image to accompany the question
                      </p>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="edit-image-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        asChild
                        className="gap-2"
                        style={{ cursor: "pointer" }}
                      >
                        <label
                          htmlFor="edit-image-upload"
                          style={{ cursor: "pointer" }}
                        >
                          <Upload className="h-4 w-4" />
                          Choose Image
                        </label>
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="edit-question-type">Question Type</Label>
                      <p className="text-sm text-muted-foreground">
                        {questionType === "multiple-choice"
                          ? "Students select from multiple options"
                          : "Students provide a written answer"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Label
                        htmlFor="edit-question-type"
                        className="text-sm font-normal"
                      >
                        {questionType === "multiple-choice"
                          ? "Multiple Choice"
                          : "Open-Ended"}
                      </Label>
                      <Switch
                        id="edit-question-type"
                        checked={questionType === "open-ended"}
                        onCheckedChange={(checked) =>
                          setQuestionType(
                            checked ? "open-ended" : "multiple-choice"
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                {questionType === "multiple-choice" && (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Answer Options</Label>
                        {options.length < 6 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddOption}
                            className="gap-2"
                            style={{ cursor: "pointer" }}
                          >
                            <Plus className="h-4 w-4" />
                            Add Option
                          </Button>
                        )}
                      </div>
                      {options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="w-8 h-8 flex items-center justify-center"
                            >
                              {String.fromCharCode(65 + index)}
                            </Badge>
                            <Input
                              placeholder={`Option ${index + 1}`}
                              value={option}
                              onChange={(e) =>
                                handleOptionChange(index, e.target.value)
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveOption(index)}
                            disabled={options.length <= 2}
                            className="h-8 w-8"
                            style={{
                              cursor:
                                options.length <= 2 ? "not-allowed" : "pointer",
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-correct-answer">
                        Correct Answer
                      </Label>
                      <Select
                        value={
                          correctAnswer !== null ? correctAnswer.toString() : ""
                        }
                        onValueChange={(value) =>
                          setCorrectAnswer(parseInt(value))
                        }
                      >
                        <SelectTrigger id="edit-correct-answer">
                          <SelectValue placeholder="Select the correct answer" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((_, index) => (
                            <SelectItem key={index} value={index.toString()}>
                              {String.fromCharCode(65 + index)}:{" "}
                              {options[index] || `Option ${index + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setEditDialogOpen(false);
                    setQuestionToEdit(null);
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleUpdateQuestion}>
                  Update Question
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </TeacherLayout>
  );
}
