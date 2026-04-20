import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, ChevronLeft, Loader2, Code2, Brain, MessageSquare, Layers } from "lucide-react";
import { toast } from "sonner";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }) };

const CODING_LANGUAGES = [
  "Candidate's Choice", "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Rust", "Swift", "Kotlin", "Ruby",
];

export default function ScheduleInterview() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    title: "",
    jobId: "",
    role: "Software Engineer",
    difficulty: "Medium",
    interviewStyle: "Professional",
    interviewType: "Mixed",
    codingQuestionsCount: "0",
    codingLanguage: "Candidate's Choice",
    questionComplexity: "Moderate",
    startTime: "",
    deadlineTime: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => { const r = await fetch("/api/jobs"); if (!r.ok) throw new Error(); return r.json(); },
  });

  const handleSubmit = async () => {
    if (!form.title || !form.startTime || !form.deadlineTime) {
      toast.error("Title, start time, and deadline are required");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/scheduled-interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          jobId: form.jobId ? Number(form.jobId) : undefined,
          codingQuestionsCount: Number(form.codingQuestionsCount),
        }),
      });
      if (!r.ok) throw new Error();
      toast.success("Interview scheduled successfully");
      setLocation("/employer");
    } catch {
      toast.error("Failed to schedule interview");
      setSaving(false);
    }
  };

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const SelectRow = ({
    label, field, options, description,
  }: { label: string; field: string; options: string[]; description?: string }) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {description && <p className="text-xs text-muted-foreground mb-2">{description}</p>}
      <div className="flex gap-2 flex-wrap">
        {options.map(o => (
          <button key={o} type="button" onClick={() => set(field, o)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${(form as any)[field] === o ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
          >{o}</button>
        ))}
      </div>
    </div>
  );

  const showCodingOptions = form.interviewType !== "Behavioral";

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0} className="mb-8">
        <Link href="/employer">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ChevronLeft className="h-4 w-4" />Back
          </button>
        </Link>
        <h1 className="text-3xl font-display font-bold mb-1">Schedule Interview</h1>
        <p className="text-muted-foreground">Create a batch interview session for multiple candidates</p>
      </motion.div>

      <div className="grid gap-5">

        {/* Basic Info */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1} className="glass-panel rounded-2xl p-6 grid gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Session Details</h2>

          <div>
            <label className="block text-sm font-medium mb-2">Interview Title *</label>
            <input value={form.title} onChange={f("title")} placeholder="e.g. Q2 Engineering Hiring — Batch 1"
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          {jobs.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Job Profile (optional)</label>
              <select value={form.jobId} onChange={f("jobId")}
                className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">No specific profile</option>
                {jobs.map((j: any) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            <input value={form.role} onChange={f("role")} placeholder="e.g. Software Engineer"
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Time *</label>
              <input type="datetime-local" value={form.startTime} onChange={f("startTime")}
                className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Deadline *</label>
              <input type="datetime-local" value={form.deadlineTime} onChange={f("deadlineTime")}
                className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
        </motion.div>

        {/* Interview Structure */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2} className="glass-panel rounded-2xl p-6 grid gap-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Interview Structure</h2>

          {/* Interview Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Interview Type</label>
            <p className="text-xs text-muted-foreground mb-3">What sections should this interview include?</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "Behavioral", icon: MessageSquare, desc: "Soft skills, situational & behavioral questions" },
                { value: "Technical", icon: Brain, desc: "Theory, coding challenges & problem solving" },
                { value: "Mixed", icon: Layers, desc: "Full-spectrum: behavioral + technical + coding" },
              ].map(({ value, icon: Icon, desc }) => (
                <button key={value} type="button" onClick={() => {
                  set("interviewType", value);
                  if (value === "Behavioral") set("codingQuestionsCount", "0");
                }}
                  className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all ${form.interviewType === value ? "border-primary bg-primary/10" : "border-border bg-secondary/50 hover:border-border/80"}`}
                >
                  <Icon className={`h-5 w-5 ${form.interviewType === value ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-semibold ${form.interviewType === value ? "text-primary" : ""}`}>{value}</span>
                  <span className="text-xs text-muted-foreground leading-snug">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          <SelectRow label="Difficulty Level" field="difficulty" options={["Easy", "Medium", "Hard"]}
            description="Controls the complexity and depth of questions asked" />

          <SelectRow label="Strictness / Interview Style" field="interviewStyle"
            options={["Friendly", "Professional", "Moderate", "Strict"]}
            description="Friendly = supportive tone; Moderate = balanced; Strict = rigorous, high-pressure" />

          <SelectRow label="Question Complexity" field="questionComplexity" options={["Standard", "Moderate", "Complex"]}
            description="Standard = foundational; Moderate = mid-level; Complex = senior/principal level" />
        </motion.div>

        {/* Coding Options */}
        {showCodingOptions && (
          <motion.div initial="hidden" animate="show" variants={fadeUp} custom={3} className="glass-panel rounded-2xl p-6 grid gap-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Code2 className="h-4 w-4" /> Coding Configuration
            </h2>

            <div>
              <label className="block text-sm font-medium mb-2">Number of Coding Questions</label>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => set("codingQuestionsCount", String(n))}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${form.codingQuestionsCount === String(n) ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                  >{n === 0 ? "None" : n}</button>
                ))}
              </div>
            </div>

            {Number(form.codingQuestionsCount) > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Coding Language</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Choose a specific language or let the candidate use their preferred one
                </p>
                <div className="flex gap-2 flex-wrap">
                  {CODING_LANGUAGES.map(lang => (
                    <button key={lang} type="button" onClick={() => set("codingLanguage", lang)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${form.codingLanguage === lang ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                    >{lang}</button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Summary */}
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={4} className="glass-panel rounded-2xl p-5 bg-secondary/30">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Interview Summary</h2>
          <div className="flex flex-wrap gap-2">
            {[
              form.interviewType,
              form.difficulty + " Difficulty",
              form.interviewStyle + " Style",
              form.questionComplexity + " Complexity",
              ...(Number(form.codingQuestionsCount) > 0
                ? [`${form.codingQuestionsCount} Coding Q${Number(form.codingQuestionsCount) > 1 ? "s" : ""}`, form.codingLanguage]
                : ["No Coding"]),
            ].map(tag => (
              <span key={tag} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">{tag}</span>
            ))}
          </div>
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={5}>
          <button onClick={handleSubmit} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold btn-gradient disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <><Loader2 className="h-5 w-5 animate-spin" />Scheduling...</> : <><Calendar className="h-5 w-5" />Schedule Interview</>}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
