"use client";

import { useEffect, useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Document {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  totalPages: number;
  totalChunks: number;
   imageCount?: number;
  status: "processing" | "ready" | "error";
  createdAt: string;
}

interface UploadProgress {
  stage: string;
  progress: number;
  message: string;
  documentId?: string;
}

export default function TeacherUpload() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null
  );
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  // Fetch documents from backend on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch("/api/rag/documents");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleCancelUpload = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported.");
      return;
    }

    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const { signal } = controller;

    setIsUploading(true);
    setUploadProgress({ stage: "uploading", progress: 0, message: "Starting upload..." });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/rag/upload", {
        method: "POST",
        body: formData,
        signal,
      });

      if (signal.aborted) return;

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        if (signal.aborted) {
          await reader.cancel().catch(() => {});
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as UploadProgress;
              setUploadProgress(data);

              if (data.stage === "complete") {
                toast.success(data.message);
                await fetchDocuments();
              } else if (data.stage === "error") {
                toast.error(data.message);
              }
            } catch {
              // ignore incomplete JSON
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        toast.info("Upload cancelled.");
        return;
      }
      if (error instanceof Error && error.name === "AbortError") {
        toast.info("Upload cancelled.");
        return;
      }
      console.error("Upload failed:", error);
      toast.error("Upload failed. Please try again.");
    } finally {
      uploadAbortRef.current = null;
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/rag/documents?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
        toast.success("Document deleted.");
      } else {
        toast.error("Failed to delete document.");
      }
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Failed to delete document.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const readyCount = documents.filter((d) => d.status === "ready").length;

  return (
    <TeacherLayout>
      <div className="flex justify-center">
        <div className="w-full max-w-4xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Knowledge Base
            </h1>
            <p className="text-muted-foreground mt-2">
              Upload course documents to power the AI Tutor with RAG-based
              responses. Students will only receive answers grounded in these
              materials.
            </p>
          </div>

          {/* Upload area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Upload Documents
              </CardTitle>
              <CardDescription>
                Upload PDF files (textbooks, notes, slides). SmartTutor will
                extract the text, create local vector embeddings with Ollama,
                and use them to answer student questions with grounded
                citations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drag-and-drop zone */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isUploading ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="absolute top-3 right-3 z-10"
                      onClick={handleCancelUpload}
                      style={{ cursor: "pointer" }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel upload
                    </Button>
                    <div className="space-y-4 pointer-events-none opacity-60">
                      <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          {uploadProgress?.message || "Processing..."}
                        </p>
                        <Progress
                          value={uploadProgress?.progress || 0}
                          className="max-w-xs mx-auto"
                        />
                        <p className="text-xs text-muted-foreground">
                          {uploadProgress?.stage === "embedding"
                            ? "This may take a few minutes for large documents."
                            : "\u00A0"}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Drag and drop a PDF here, or click to select
                    </p>
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={handleInputChange}
                      ref={fileInputRef}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      asChild
                      className="gap-2"
                      style={{ cursor: "pointer" }}
                    >
                      <label htmlFor="file-upload" style={{ cursor: "pointer" }}>
                        Choose PDF File
                      </label>
                    </Button>
                  </>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Supported format: PDF. On first use, the system requires the
                configured Ollama embedding model (
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  mxbai-embed-large
                </code>
                ) to be available; if not already present, run{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  ollama pull mxbai-embed-large
                </code>
                .
              </p>
            </CardContent>
          </Card>

          {/* Document list */}
          <Card>
            <CardHeader>
              <CardTitle>Uploaded Documents</CardTitle>
              <CardDescription>
                {isLoadingDocs
                  ? "Loading..."
                  : `${readyCount} document${readyCount !== 1 ? "s" : ""} ready for the AI Tutor`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingDocs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No documents uploaded yet. Upload your first document to get
                  started.
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.name}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              {doc.size}
                            </span>
                            {doc.totalPages > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {doc.totalPages} pages
                              </span>
                            )}
                            {doc.totalChunks > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {doc.totalChunks} chunks
                              </span>
                            )}
                            {typeof doc.imageCount === "number" &&
                              doc.imageCount > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {doc.imageCount}{" "}
                                  {doc.imageCount === 1 ? "image" : "images"}
                                </span>
                              )}
                            <span className="text-xs text-muted-foreground">
                              Uploaded{" "}
                              {new Date(doc.createdAt).toLocaleString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant={
                            doc.status === "ready"
                              ? "default"
                              : doc.status === "processing"
                                ? "secondary"
                                : "destructive"
                          }
                          className="flex items-center gap-1"
                        >
                          {doc.status === "ready" && (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {doc.status === "processing" && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          {doc.status === "error" && (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          {doc.status === "ready"
                            ? "Ready"
                            : doc.status === "processing"
                              ? "Processing"
                              : "Error"}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(doc.id)}
                        className="ml-4 text-muted-foreground hover:text-destructive"
                        style={{ cursor: "pointer" }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TeacherLayout>
  );
}
