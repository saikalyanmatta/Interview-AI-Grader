import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Upload, FileText, Mic, Settings, ChevronRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }) };

const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
const STYLES = ["Friendly", "Professional", "Strict"] as const;
const CODING_LANGS = ["Python", "JavaScript", "TypeScript", "Java", "C++", "Go", "None"] as const;

export default function InterviewSetup() {
  const [, setLocation] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState("Software Engineer");
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>("Medium");
  const [style, setStyle] = useState<typeof STYLES[number]>("Friendly");
  const [codingLang, setCodingLang] = useState("Python");
  const [jobId, setJobId] = useState<number | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => { const r = await fetch("/api/jobs"); if (!r.ok) throw new Error(); return r.json(); },
  });

  const handleFileUpload = async (file: File) => {
    setResumeFile(file);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const tempIv = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, difficulty, interviewStyle: style }),
      }).then(r => r.json());

      const r = await fetch(`/api/interviews/${tempIv.id}/resume/upload`, { method: "POST", body: fd });
      const data = await r.json();
      if (data.resumeText) setResumeText(data.resumeText);
      toast.success("Resume parsed successfully");
      await fetch(`/api/interviews/${tempIv.id}`, { method: "DELETE" });
    } catch {
      toast.error("Failed to parse resume");
    }
    setUploading(false);
  };

  const handleStart = async () => {
    if (!resumeText.trim() && !resumeFile) {
      toast.error("Please add your resume to continue");
      return;
    }
    setCreating(true);
    try {
      const ivRes = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, difficulty, interviewStyle: style, jobId: jobId || undefined, codingLanguage: codingLang === "None" ? undefined : codingLang }),
      });
      const iv = await ivRes.json();
      if (resumeText.trim()) {
        await fetch(`/api/interviews/${iv.id}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText }),
        });
      }
      setLocation(`/interview/${iv.id}`);
    } catch {
      toast.error("Failed to create interview");
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0} className="mb-8">
        <h1 className="text-3xl font-display font-bold mb-2">Set Up Your Interview</h1>
        <p className="text-muted-foreground">Configure your session and upload your resume to get started</p>
      </motion.div>

      <div className="grid gap-6">
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1} className="glass-panel rounded-2xl p-6">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Your Resume</h2>
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all mb-4"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
          >
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Parsing resume...</p>
              </div>
            ) : resumeFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-8 w-8 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{resumeFile.name}</p>
                <p className="text-xs text-muted-foreground">Click to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium mb-1">Drop your resume here or click to upload</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT — max 20MB</p>
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">or paste text</span></div>
          </div>
          <textarea
            value={resumeText}
            onChange={e => setResumeText(e.target.value)}
            placeholder="Paste your resume text here..."
            className="mt-4 w-full h-32 rounded-xl bg-secondary/50 border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2} className="glass-panel rounded-2xl p-6">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2"><Settings className="h-5 w-5 text-primary" />Interview Configuration</h2>
          <div className="grid gap-5">
            <div>
              <label className="block text-sm font-medium mb-2">Target Role</label>
              <input
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. Software Engineer, Product Manager..."
              />
            </div>

            {jobs.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Job Profile (optional)</label>
                <select
                  value={jobId ?? ""}
                  onChange={e => setJobId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">No specific job profile</option>
                  {jobs.map((j: any) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Difficulty</label>
              <div className="flex gap-2">
                {DIFFICULTIES.map(d => (
                  <button key={d} onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${difficulty === d ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                  >{d}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Interview Style</label>
              <div className="flex gap-2">
                {STYLES.map(s => (
                  <button key={s} onClick={() => setStyle(s)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${style === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                  >{s}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Coding Language</label>
              <div className="flex flex-wrap gap-2">
                {CODING_LANGS.map(l => (
                  <button key={l} onClick={() => setCodingLang(l)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${codingLang === l ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                  >{l}</button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={3}>
          <button
            onClick={handleStart}
            disabled={creating || uploading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold btn-gradient text-base disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {creating ? <><Loader2 className="h-5 w-5 animate-spin" />Starting Interview...</> : <><Mic className="h-5 w-5" />Start Interview <ChevronRight className="h-5 w-5" /></>}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
