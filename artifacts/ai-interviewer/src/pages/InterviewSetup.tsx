import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Mic, ChevronRight, ChevronLeft,
  Loader2, CheckCircle2, Zap, Shield, Smile, Code2,
  BrainCircuit, BarChart2, Briefcase,
} from "lucide-react";
import { toast } from "sonner";

const DIFFICULTIES = [
  { value: "Easy", icon: Smile, desc: "Warm-up questions, junior-level concepts" },
  { value: "Medium", icon: BarChart2, desc: "Core concepts, practical scenarios" },
  { value: "Hard", icon: Zap, desc: "Complex problems, senior-level depth" },
] as const;

const STYLES = [
  { value: "Friendly", icon: Smile, desc: "Conversational and encouraging" },
  { value: "Professional", icon: Briefcase, desc: "Formal, structured interview" },
  { value: "Strict", icon: Shield, desc: "Rigorous, high-pressure simulation" },
] as const;

const CODING_LANGS = ["None", "Python", "JavaScript", "TypeScript", "Java", "C++", "Go", "Rust", "SQL"] as const;

const PRESETS = [
  { label: "FAANG Prep", difficulty: "Hard" as const, style: "Professional" as const, lang: "Python" },
  { label: "Startup Casual", difficulty: "Medium" as const, style: "Friendly" as const, lang: "JavaScript" },
  { label: "Entry Level", difficulty: "Easy" as const, style: "Friendly" as const, lang: "Python" },
  { label: "System Design", difficulty: "Hard" as const, style: "Professional" as const, lang: "None" },
];

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0, transition: { duration: 0.2 } }),
};

export default function InterviewSetup() {
  const [, setLocation] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const [role, setRole] = useState("Software Engineer");
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]["value"]>("Medium");
  const [style, setStyle] = useState<typeof STYLES[number]["value"]>("Professional");
  const [codingLang, setCodingLang] = useState("Python");
  const [jobId, setJobId] = useState<number | null>(null);

  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => { const r = await fetch("/api/jobs"); if (!r.ok) throw new Error(); return r.json(); },
  });

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

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
      if (data.skills?.length) setSkills(data.skills);
      toast.success("Resume parsed successfully");
      await fetch(`/api/interviews/${tempIv.id}`, { method: "DELETE" }).catch(() => {});
    } catch {
      toast.error("Failed to parse resume. Try pasting the text instead.");
    }
    setUploading(false);
  };

  const applyPreset = (p: typeof PRESETS[number]) => {
    setDifficulty(p.difficulty);
    setStyle(p.style);
    setCodingLang(p.lang);
  };

  const handleStart = async () => {
    if (!resumeText.trim()) {
      toast.error("Please add your resume to continue");
      return;
    }
    setCreating(true);
    try {
      const ivRes = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          difficulty,
          interviewStyle: style,
          jobId: jobId || undefined,
          codingLanguage: codingLang === "None" ? undefined : codingLang,
        }),
      });
      const iv = await ivRes.json();
      await fetch(`/api/interviews/${iv.id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });
      setLocation(`/interview/${iv.id}`);
    } catch {
      toast.error("Failed to create interview");
      setCreating(false);
    }
  };

  const steps = ["Resume", "Difficulty", "Role & Tech"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-10 px-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-display font-bold mb-1">Set Up Your Interview</h1>
          <p className="text-muted-foreground text-sm">Personalize your session in 3 quick steps</p>
        </div>

        <div className="flex items-center justify-center gap-0 mb-8">
          {steps.map((label, i) => (
            <React.Fragment key={i}>
              <button
                onClick={() => i < step ? go(i) : undefined}
                className={`flex flex-col items-center gap-1 transition-all ${i <= step ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  i < step ? "bg-primary border-primary text-primary-foreground" :
                  i === step ? "border-primary text-primary bg-primary/10" :
                  "border-border text-muted-foreground bg-secondary/50"
                }`}>
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${i === step ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-16 mx-1 mb-4 rounded transition-all ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>
            {step === 0 && (
              <motion.div key="step0" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" /> Upload Your Resume
                  </h2>

                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      resumeFile ? "border-emerald-500/60 bg-emerald-500/5" : "border-border hover:border-primary/50 hover:bg-primary/5"
                    }`}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
                  >
                    <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                    {uploading ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Parsing your resume with AI…</p>
                      </div>
                    ) : resumeFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{resumeFile.name}</p>
                        <p className="text-xs text-muted-foreground">Click to replace</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium mb-1">Drop your resume here or click to browse</p>
                          <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT · max 20MB</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {skills.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 font-medium">Skills detected:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {skills.slice(0, 20).map(s => (
                          <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">or paste text</span></div>
                  </div>

                  <textarea
                    value={resumeText}
                    onChange={e => setResumeText(e.target.value)}
                    placeholder="Paste your resume text here…"
                    className="w-full h-28 rounded-xl bg-secondary/50 border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                  />
                </div>

                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => { if (!resumeText.trim() && !resumeFile) { toast.error("Please add your resume first"); return; } go(1); }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold btn-gradient"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                  <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-primary" /> Difficulty & Style
                  </h2>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Presets</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PRESETS.map(p => (
                        <button key={p.label} onClick={() => applyPreset(p)}
                          className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all text-left ${
                            difficulty === p.difficulty && style === p.style && codingLang === p.lang
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary/40"
                          }`}>
                          {p.label}
                          <span className="block text-xs opacity-60 mt-0.5">{p.difficulty} · {p.style}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Difficulty</p>
                    <div className="grid grid-cols-3 gap-2">
                      {DIFFICULTIES.map(({ value, icon: Icon, desc }) => (
                        <button key={value} onClick={() => setDifficulty(value)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            difficulty === value ? "border-primary bg-primary/10" : "border-border bg-secondary/50 hover:border-primary/40"
                          }`}>
                          <Icon className={`h-4 w-4 mb-1.5 ${difficulty === value ? "text-primary" : "text-muted-foreground"}`} />
                          <p className={`text-sm font-semibold ${difficulty === value ? "text-primary" : ""}`}>{value}</p>
                          <p className="text-xs text-muted-foreground leading-tight mt-0.5">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Interview Style</p>
                    <div className="grid grid-cols-3 gap-2">
                      {STYLES.map(({ value, icon: Icon, desc }) => (
                        <button key={value} onClick={() => setStyle(value)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            style === value ? "border-primary bg-primary/10" : "border-border bg-secondary/50 hover:border-primary/40"
                          }`}>
                          <Icon className={`h-4 w-4 mb-1.5 ${style === value ? "text-primary" : "text-muted-foreground"}`} />
                          <p className={`text-sm font-semibold ${style === value ? "text-primary" : ""}`}>{value}</p>
                          <p className="text-xs text-muted-foreground leading-tight mt-0.5">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-4">
                  <button onClick={() => go(0)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium border border-border bg-secondary/60 hover:bg-secondary text-sm transition-all">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button onClick={() => go(2)} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold btn-gradient">
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                  <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                    <Code2 className="h-5 w-5 text-primary" /> Role & Technical Focus
                  </h2>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Target Role</label>
                    <input
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="e.g. Software Engineer, Product Manager…"
                    />
                  </div>

                  {jobs.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Job Profile <span className="normal-case font-normal">(optional)</span></label>
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
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Coding Questions</label>
                    <div className="flex flex-wrap gap-2">
                      {CODING_LANGS.map(l => (
                        <button key={l} onClick={() => setCodingLang(l)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                            codingLang === l ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary/40"
                          }`}>
                          {l === "None" ? "No coding questions" : l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-secondary/40 border border-border p-4 text-sm space-y-1.5">
                    <p className="font-semibold text-sm mb-2">Interview Summary</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground text-xs">
                      <span><span className="text-foreground font-medium">Role:</span> {role}</span>
                      <span><span className="text-foreground font-medium">Difficulty:</span> {difficulty}</span>
                      <span><span className="text-foreground font-medium">Style:</span> {style}</span>
                      <span><span className="text-foreground font-medium">Coding:</span> {codingLang === "None" ? "None" : codingLang}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-4">
                  <button onClick={() => go(1)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium border border-border bg-secondary/60 hover:bg-secondary text-sm transition-all">
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={handleStart}
                    disabled={creating}
                    className="flex items-center gap-2 px-7 py-3 rounded-xl font-bold btn-gradient disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {creating ? <><Loader2 className="h-4 w-4 animate-spin" />Starting…</> : <><Mic className="h-4 w-4" />Start Interview</>}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
