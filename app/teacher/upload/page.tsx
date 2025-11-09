"use client";

import { useState } from "react";
import TeacherLayout from "@/components/teacher-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, X, CheckCircle2, Sparkles } from "lucide-react";

interface UploadedDocument {
  id: string;
  name: string;
  size: string;
  uploadDate: Date;
  status: "uploaded" | "processing" | "ready";
}

export default function TeacherUpload() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([
    {
      id: "1",
      name: "Calculus_Textbook_Chapter1.pdf",
      size: "2.4 MB",
      uploadDate: new Date("2024-11-01"),
      status: "ready",
    },
    {
      id: "2",
      name: "Physics_Lab_Manual.pdf",
      size: "1.8 MB",
      uploadDate: new Date("2024-11-05"),
      status: "ready",
    },
  ]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadSuccess(false);

    // Simulate upload and processing
    setTimeout(() => {
      const newDoc: UploadedDocument = {
        id: Date.now().toString(),
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        uploadDate: new Date(),
        status: "ready",
      };
      setDocuments([...documents, newDoc]);
      setUploading(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    }, 2000);
  };

  const handleDelete = (id: string) => {
    setDocuments(documents.filter((doc) => doc.id !== id));
  };

  return (
    <TeacherLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground mt-2">
            Upload documents to enhance the AI Tutor with RAG-based responses
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Knowledge Base
            </CardTitle>
            <CardDescription>
              Upload PDF, DOCX, or TXT files. The AI Tutor will use these
              documents to provide contextually relevant answers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadSuccess && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Document uploaded and processed successfully!
                </AlertDescription>
              </Alert>
            )}

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop files here, or click to select
              </p>
              <Input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="file-upload"
              />
              <Button
                asChild
                disabled={uploading}
                className="gap-2"
                style={{ cursor: "pointer" }}
              >
                <label htmlFor="file-upload" style={{ cursor: "pointer" }}>
                  {uploading ? "Uploading..." : "Choose File"}
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>
              {documents.length} document{documents.length !== 1 ? "s" : ""}{" "}
              available for RAG chatbot
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
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
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">{doc.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {doc.size}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            • Uploaded {doc.uploadDate.toLocaleDateString("en-US", { year: "numeric", month: "numeric", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          doc.status === "ready"
                            ? "default"
                            : doc.status === "processing"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {doc.status === "ready"
                          ? "Ready"
                          : doc.status === "processing"
                          ? "Processing"
                          : "Uploaded"}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc.id)}
                      className="ml-4"
                      style={{ cursor: "pointer" }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TeacherLayout>
  );
}

