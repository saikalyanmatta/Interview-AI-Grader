import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateInterview, useListJobs } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, FileText, Upload, ChevronRight, Check, X, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function uploadResumeFile(interviewId: number, file: File, candidateName: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("candidateName", candidateName);
  const resp = await fetch(`${BASE}/api/interviews/${interviewId}/resume/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as any).error || "File upload failed");
  }
  return resp.json();
}

async function uploadResumeText(interviewId: number, resumeText: string, candidateName: string) {
  const resp = await fetch(`${BASE}/api/interviews/${interviewId}/resume`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText, candidateName }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as any).error || "Resume upload failed");
  }
  return resp.json();
}

export default function InterviewSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [resumeText, setResumeText] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [role, setRole] = useState("Software Engineer");
  const [difficulty, setDifficulty] = useState("Medium");
  const [interviewStyle, setInterviewStyle] = useState("Friendly");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: jobs } = useListJobs();
  const createMutation = useCreateInterview();

  const handleFileChange = (file: File) => {
    const nameOk = file.name.match(/\.(pdf|docx|txt)$/i);
    if (!nameOk) {
      toast({ title: "Unsupported file", description: "Please upload a PDF, DOCX, or TXT file.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleStart = async () => {
    const hasResume = inputMode === "file" ? !!selectedFile : resumeText.trim().length > 0;
    if (!hasResume) {
      toast({ title: "Resume required", description: inputMode === "file" ? "Please upload your resume file." : "Please paste your resume text.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const interview = await createMutation.mutateAsync({ data: { jobId: selectedJobId || undefined, role, difficulty, interviewStyle } as any });
      if (inputMode === "file" && selectedFile) {
        await uploadResumeFile(interview.id, selectedFile, candidateName || "Candidate");
      } else {
        await uploadResumeText(interview.id, resumeText, candidateName || "Candidate");
      }
      setLocation(`/interview/${interview.id}`);
    } catch (error: any) {
      toast({ title: "Setup failed", description: error.message || "Failed to start interview", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-display font-bold">Setup Interview</h1>
        <p className="text-muted-foreground mt-2">Provide your details so the AI can tailor the adaptive session.</p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2">
          {[1, 2].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={`h-1 w-12 rounded-full ${step >= s ? "bg-primary" : "bg-secondary"}`} />}
              <button
                onClick={() => step > s ? setStep(s) : undefined}
                className={`h-8 w-8 rounded-full flex items-center justify-center font-bold transition-colors ${step >= s ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </button>
            </div>
          ))}
        </div>
      </div>

      <Card className="glass-panel border-white/10 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 text-center">
            <BrainCircuit className="h-16 w-16 text-primary animate-pulse mb-6" />
            <h3 className="text-2xl font-display font-bold mb-2">Analyzing Resume...</h3>
            <p className="text-muted-foreground max-w-md">Extracting your skills to prepare an adaptive, personalized interview session.</p>
          </div>
        )}

        <CardContent className="p-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Your Name</label>
                  <Input placeholder="Full name (optional)" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} className="bg-black/20 border-white/10" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">Resume</label>
                  <div className="flex gap-2 mb-4">
                    {(["file", "text"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setInputMode(mode)}
                        className={cn("flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all border", inputMode === mode ? "bg-primary/20 border-primary text-primary" : "border-white/10 text-muted-foreground hover:border-white/30")}
                      >
                        {mode === "file" ? <><Upload className="h-4 w-4 inline mr-2" />Upload File</> : <><FileText className="h-4 w-4 inline mr-2" />Paste Text</>}
                      </button>
                    ))}
                  </div>

                  {inputMode === "file" ? (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileRef.current?.click()}
                      className={cn("border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all", isDragging ? "border-primary bg-primary/10" : "border-white/20 hover:border-white/40 hover:bg-white/5", selectedFile && "border-emerald-500/50 bg-emerald-500/5")}
                    >
                      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }} />
                      {selectedFile ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-lg">
                            <FileUp className="h-5 w-5 text-emerald-400" />
                            <span className="text-sm font-medium text-emerald-400">{selectedFile.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-emerald-400/60 hover:text-emerald-400">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">Click to replace</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <Upload className="h-10 w-10 text-white/20" />
                          <div>
                            <p className="font-medium text-white/60">Drop your resume here or click to browse</p>
                            <p className="text-xs mt-1">PDF, DOCX, or TXT — up to 20 MB</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Textarea placeholder="Paste your full resume text here..." value={resumeText} onChange={(e) => setResumeText(e.target.value)} className="min-h-[200px] bg-black/20 border-white/10 font-mono text-sm" />
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                  <Button variant="gradient" onClick={() => setStep(2)}>
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Role</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                    {["Software Engineer", "Product Manager", "HR Interview"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setRole(option)}
                        className={cn("p-3 rounded-xl border text-sm font-medium transition-all", role === option ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/30")}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  <label className="block text-sm font-medium mb-2">Select Difficulty</label>
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {["Easy", "Medium", "Hard"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setDifficulty(option)}
                        className={cn("p-3 rounded-xl border text-sm font-medium transition-all", difficulty === option ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/30")}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  <label className="block text-sm font-medium mb-2">Select Interview Style</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                    {["Friendly", "Strict", "Technical Deep Dive"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setInterviewStyle(option)}
                        className={cn("p-3 rounded-xl border text-sm font-medium transition-all", interviewStyle === option ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/30")}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  <label className="block text-sm font-medium mb-2">Interview Profile <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <p className="text-xs text-muted-foreground mb-4">Choose a job profile for skill-specific grading, or run a general adaptive assessment.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div onClick={() => setSelectedJobId(null)} className={cn("p-4 rounded-xl border cursor-pointer transition-all", selectedJobId === null ? "border-primary bg-primary/10" : "border-white/10 bg-black/20 hover:border-white/30")}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold">General Assessment</h4>
                        {selectedJobId === null && <Check className="h-5 w-5 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground">Adaptive interview based on your resume skills — number of questions adjusts dynamically.</p>
                    </div>
                    {jobs?.map((job) => (
                      <div key={job.id} onClick={() => setSelectedJobId(job.id)} className={cn("p-4 rounded-xl border cursor-pointer transition-all", selectedJobId === job.id ? "border-primary bg-primary/10" : "border-white/10 bg-black/20 hover:border-white/30")}>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold truncate pr-2">{job.title}</h4>
                          {selectedJobId === job.id && <Check className="h-5 w-5 text-primary shrink-0" />}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {job.skills.slice(0, 3).map((s, i) => <Badge key={i} variant="outline" className="text-[10px]">{s.name}</Badge>)}
                          {job.skills.length > 3 && <span className="text-xs text-muted-foreground">+{job.skills.length - 3}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-white/10">
                  <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                  <Button variant="gradient" onClick={handleStart} disabled={isLoading}>
                    {isLoading ? "Preparing..." : "Begin Interview"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
