import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, CheckCircle2, Loader2, Star,
  TrendingUp, AlertTriangle, Target, ChevronRight,
  BarChart2, Zap, Award
} from "lucide-react";
import { toast } from "sonner";

const EXPERIENCE_LEVELS = [
  { value: "fresher", label: "Fresher", sub: "0–1 years", desc: "Fresh grad or career starter" },
  { value: "junior", label: "Junior", sub: "1–3 years", desc: "Entry-level professional" },
  { value: "mid", label: "Mid-Level", sub: "3–6 years", desc: "Growing professional" },
  { value: "senior", label: "Senior", sub: "6+ years", desc: "Experienced leader" },
];

const BREAKDOWN_LABELS: Record<string, string> = {
  skills_match: "Skills Match",
  experience_relevance: "Experience Relevance",
  impact_metrics: "Impact & Metrics",
  formatting_clarity: "Formatting & Clarity",
  keywords_ats: "ATS Keywords",
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#6366f1" : score >= 40 ? "#f59e0b" : "#ef4444";
  const grade = score >= 90 ? "A+" : score >= 85 ? "A" : score >= 80 ? "A-" : score >= 75 ? "B+" : score >= 70 ? "B" : score >= 65 ? "B-" : score >= 60 ? "C+" : score >= 50 ? "C" : "D";
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.75;
  const dashOffset = arc - (score / 100) * arc;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="160" height="120" viewBox="0 0 160 120">
        <circle cx="80" cy="90" r={r} fill="none" stroke="currentColor" strokeWidth="12"
          strokeOpacity="0.1" strokeDasharray={`${arc} ${circumference}`}
          strokeDashoffset={-circumference * 0.125} strokeLinecap="round"
          transform="rotate(0, 80, 90)" />
        <circle cx="80" cy="90" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${arc} ${circumference}`}
          strokeDashoffset={-circumference * 0.125 + dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-out" }} />
        <text x="80" y="82" textAnchor="middle" fontSize="32" fontWeight="bold" fill={color}>{score}</text>
        <text x="80" y="100" textAnchor="middle" fontSize="13" fill="currentColor" opacity="0.5">/ 100</text>
      </svg>
      <span className="text-xs font-semibold px-3 py-1 rounded-full border" style={{ color, borderColor: color + "40", background: color + "15" }}>
        Grade: {grade}
      </span>
    </div>
  );
}

function ScoreBar({ score, label, comment }: { score: number; label: string; comment: string }) {
  const color = score >= 75 ? "bg-emerald-500" : score >= 55 ? "bg-indigo-500" : score >= 35 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-bold tabular-nums">{score}/100</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
      </div>
      <p className="text-xs text-muted-foreground">{comment}</p>
    </div>
  );
}

export default function ResumeScorer() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [role, setRole] = useState("Software Engineer");
  const [experience, setExperience] = useState("mid");
  const [uploading, setUploading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileUpload = async (file: File) => {
    setResumeFile(file);
    setUploading(true);
    try {
      const tempIv = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, difficulty: "Medium", interviewStyle: "Professional" }),
      }).then(r => r.json());

      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/interviews/${tempIv.id}/resume/upload`, { method: "POST", body: fd });
      const data = await r.json();
      if (data.resumeText) {
        setResumeText(data.resumeText);
        toast.success("Resume parsed successfully");
      }
      await fetch(`/api/interviews/${tempIv.id}`, { method: "DELETE" }).catch(() => {});
    } catch {
      toast.error("Could not parse file — please paste your resume text below");
    }
    setUploading(false);
  };

  const handleScore = async () => {
    if (!resumeText.trim()) {
      toast.error("Please add your resume text first");
      return;
    }
    setScoring(true);
    setResult(null);
    try {
      const r = await fetch("/api/resume-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, role, experience }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setResult(data);
    } catch {
      toast.error("Failed to score resume — please try again");
    }
    setScoring(false);
  };

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
            <Star className="h-3.5 w-3.5" /> AI-Powered Resume Scorer
          </div>
          <h1 className="text-3xl font-display font-bold mb-2">Score Your Resume</h1>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm">
            Get an instant AI-graded score (0–100) based on your target role and experience level, with actionable feedback.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 space-y-5">
          <h2 className="font-display font-semibold text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Your Resume
          </h2>

          <div
            className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all ${
              resumeFile ? "border-emerald-500/60 bg-emerald-500/5" : "border-border hover:border-primary/50 hover:bg-primary/5"
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
          >
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Extracting resume text…</p>
              </div>
            ) : resumeFile ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{resumeFile.name}</p>
                <p className="text-xs text-muted-foreground">Click to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-7 w-7 text-muted-foreground" />
                <p className="text-sm font-medium">Drop your resume or click to browse</p>
                <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT</p>
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
            placeholder="Paste your full resume text here…"
            className="w-full h-36 rounded-xl bg-secondary/50 border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
        </div>

        <div className="glass-panel rounded-2xl p-6 space-y-5">
          <h2 className="font-display font-semibold text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Target Role & Experience
          </h2>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Target Role</label>
            <input
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g. Software Engineer, Product Manager, Data Scientist…"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Experience Level</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EXPERIENCE_LEVELS.map(lvl => (
                <button key={lvl.value} onClick={() => setExperience(lvl.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    experience === lvl.value ? "border-primary bg-primary/10" : "border-border bg-secondary/50 hover:border-primary/40"
                  }`}>
                  <p className={`text-sm font-bold ${experience === lvl.value ? "text-primary" : ""}`}>{lvl.label}</p>
                  <p className={`text-xs ${experience === lvl.value ? "text-primary/70" : "text-muted-foreground"}`}>{lvl.sub}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{lvl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleScore}
            disabled={scoring || uploading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold btn-gradient disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {scoring
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Scoring your resume…</>
              : <><BarChart2 className="h-5 w-5" /> Score My Resume <ChevronRight className="h-4 w-4" /></>
            }
          </button>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="glass-panel rounded-2xl p-6">
                <h2 className="font-display font-semibold text-base mb-5 flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" /> Your Score
                </h2>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <ScoreGauge score={result.overall_score ?? 0} />
                  <div className="flex-1 space-y-2">
                    <p className="text-base font-semibold">{result.verdict}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
                    <div className="flex gap-2 flex-wrap mt-3">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        {role}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
                        {EXPERIENCE_LEVELS.find(l => l.value === experience)?.label} Level
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {result.breakdown && (
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h2 className="font-display font-semibold text-base flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-primary" /> Score Breakdown
                  </h2>
                  <div className="space-y-5">
                    {Object.entries(result.breakdown).map(([key, val]: [string, any]) => (
                      <ScoreBar key={key} label={BREAKDOWN_LABELS[key] || key} score={val.score} comment={val.comment} />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                {result.strengths?.length > 0 && (
                  <div className="glass-panel rounded-2xl p-5 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Zap className="h-4 w-4" /> Strengths
                    </h3>
                    <ul className="space-y-2">
                      {result.strengths.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.improvements?.length > 0 && (
                  <div className="glass-panel rounded-2xl p-5 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <TrendingUp className="h-4 w-4" /> Improvements
                    </h3>
                    <ul className="space-y-2">
                      {result.improvements.map((s: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <ChevronRight className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {(result.missing_skills?.length > 0 || result.ats_keywords_found?.length > 0) && (
                <div className="glass-panel rounded-2xl p-5 space-y-4">
                  {result.missing_skills?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-sm flex items-center gap-2 text-red-500 mb-2">
                        <AlertTriangle className="h-4 w-4" /> Missing Skills / Keywords
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {result.missing_skills.map((s: string) => (
                          <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.ats_keywords_found?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-sm flex items-center gap-2 text-emerald-500 mb-2">
                        <CheckCircle2 className="h-4 w-4" /> ATS Keywords Found
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {result.ats_keywords_found.map((s: string) => (
                          <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
