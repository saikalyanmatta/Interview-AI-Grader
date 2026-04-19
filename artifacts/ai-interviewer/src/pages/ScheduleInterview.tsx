import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }) };

export default function ScheduleInterview() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    title: "",
    jobId: "",
    role: "Software Engineer",
    difficulty: "Medium",
    interviewStyle: "Friendly",
    startTime: "",
    deadlineTime: "",
    codingQuestionsCount: "0",
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

  const SelectRow = ({ label, field, options }: { label: string; field: string; options: string[] }) => (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {options.map(o => (
          <button key={o} type="button" onClick={() => setForm(prev => ({ ...prev, [field]: o }))}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${(form as any)[field] === o ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
          >{o}</button>
        ))}
      </div>
    </div>
  );

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
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1} className="glass-panel rounded-2xl p-6 grid gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Interview Title *</label>
            <input value={form.title} onChange={f("title")} placeholder="e.g. Q2 Engineering Hiring — Batch 1"
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          {jobs.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Job Profile (optional)</label>
              <select value={form.jobId} onChange={f("jobId")}
                className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
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

          <SelectRow label="Difficulty" field="difficulty" options={["Easy", "Medium", "Hard"]} />
          <SelectRow label="Interview Style" field="interviewStyle" options={["Friendly", "Professional", "Strict"]} />

          <div>
            <label className="block text-sm font-medium mb-2">Coding Questions</label>
            <select value={form.codingQuestionsCount} onChange={f("codingQuestionsCount")}
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n === 0 ? "None" : `${n} question${n > 1 ? "s" : ""}`}</option>)}
            </select>
          </div>
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2}>
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
