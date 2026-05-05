import React, { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Briefcase, Zap, Loader2, Brain, MessageSquare,
  Code2, Target, ChevronDown, ChevronUp, Search, Filter
} from "lucide-react";
import { toast } from "sonner";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.06 } }) };

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  "Behavioral": { icon: MessageSquare, color: "text-emerald-500" },
  "Technical Theory": { icon: Brain, color: "text-blue-500" },
  "Skill-Specific": { icon: Target, color: "text-purple-500" },
  "Problem Solving": { icon: Code2, color: "text-orange-500" },
  "Role-Specific": { icon: Briefcase, color: "text-pink-500" },
};

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Medium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  Hard: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function JobProfileView() {
  const [, params] = useRoute("/employer/jobs/:id");
  const jobId = params?.id ? Number(params.id) : null;
  const [questions, setQuestions] = useState<any[]>([]);
  const [generated, setGenerated] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [filterDiff, setFilterDiff] = useState("All");
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const r = await fetch(`/api/jobs/${jobId}`);
      if (!r.ok) throw new Error("Job not found");
      return r.json();
    },
  });

  const genMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/jobs/${jobId}/generate-questions`, { method: "POST" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail || "Failed to generate"); }
      return r.json();
    },
    onSuccess: (data) => {
      setQuestions(data.questions || []);
      setGenerated(true);
      toast.success(`Generated ${data.questions?.length || 0} questions`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = questions.filter(q => {
    const matchSearch = !search || q.question.toLowerCase().includes(search.toLowerCase()) || (q.skill || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "All" || q.category === filterCat;
    const matchDiff = filterDiff === "All" || q.difficulty === filterDiff;
    return matchSearch && matchCat && matchDiff;
  });

  const categories = ["All", ...Array.from(new Set(questions.map(q => q.category)))];
  const grouped = generated
    ? (filterCat === "All"
        ? Array.from(new Set(filtered.map(q => q.category))).map(cat => ({ cat, qs: filtered.filter(q => q.category === cat) }))
        : [{ cat: filterCat, qs: filtered }])
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <p className="text-muted-foreground">Job profile not found.</p>
        <Link href="/employer"><button className="mt-4 px-4 py-2 rounded-xl btn-gradient text-sm">Back to Dashboard</button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0} className="mb-8">
        <Link href="/employer">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ChevronLeft className="h-4 w-4" />Back to Dashboard
          </button>
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold mb-1">{job.title}</h1>
            <p className="text-muted-foreground">{job.role}</p>
          </div>
          {!generated && (
            <button
              onClick={() => genMutation.mutate()}
              disabled={genMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold btn-gradient disabled:opacity-60 text-sm"
            >
              {genMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
                : <><Zap className="h-4 w-4" />Generate Question Bank</>}
            </button>
          )}
        </div>
      </motion.div>

      {/* Job Details */}
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1} className="glass-panel rounded-2xl p-6 mb-6 grid gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</p>
          <p className="text-sm leading-relaxed">{job.description}</p>
        </div>
        {job.skills?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Required Skills</p>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-sm">
                  <span className="font-medium text-primary">{s.name}</span>
                  <span className="text-xs text-muted-foreground">L{s.requiredLevel}/10</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Question Bank */}
      {!generated && !genMutation.isPending && (
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2}
          className="glass-panel rounded-2xl p-12 text-center border-dashed border-2 border-border">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-display font-bold mb-2">AI Question Bank</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Generate ~50 tailored interview questions based on the skills and role defined in this job profile.
          </p>
          <button
            onClick={() => genMutation.mutate()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold btn-gradient text-sm"
          >
            <Zap className="h-4 w-4" />Generate Questions
          </button>
        </motion.div>
      )}

      {genMutation.isPending && (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="font-medium mb-1">Generating question bank…</p>
          <p className="text-sm text-muted-foreground">AI is crafting 50 questions tailored to this role</p>
        </div>
      )}

      {generated && questions.length > 0 && (
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2} className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-display font-bold">{questions.length} Questions Generated</h2>
              <p className="text-sm text-muted-foreground">Use these as a reference for live or AI interviews</p>
            </div>
            <button onClick={() => genMutation.mutate()} disabled={genMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition-colors">
              <Zap className="h-3.5 w-3.5" />Regenerate
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions…"
                className="pl-8 pr-3 py-2 text-xs rounded-xl bg-secondary/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 w-48" />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="text-xs rounded-xl bg-secondary/50 border border-border px-2 py-2 focus:outline-none">
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <select value={filterDiff} onChange={e => setFilterDiff(e.target.value)}
              className="text-xs rounded-xl bg-secondary/50 border border-border px-2 py-2 focus:outline-none">
              {["All", "Easy", "Medium", "Hard"].map(d => <option key={d}>{d}</option>)}
            </select>
            <span className="text-xs text-muted-foreground ml-1">{filtered.length} shown</span>
          </div>

          {grouped.map(({ cat, qs }) => {
            if (!qs.length) return null;
            const cfg = CATEGORY_CONFIG[cat] || { icon: Brain, color: "text-primary" };
            const Icon = cfg.icon;
            return (
              <div key={cat} className="glass-panel rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-secondary/20">
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                  <span className="font-semibold text-sm">{cat}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{qs.length} questions</span>
                </div>
                <div className="divide-y divide-border/30">
                  {qs.map((q, qi) => (
                    <div key={qi}>
                      <button
                        onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                        className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-secondary/20 transition-colors"
                      >
                        <span className="text-xs text-muted-foreground w-6 shrink-0 mt-0.5">{q.id}.</span>
                        <span className="text-sm flex-1 leading-snug">{q.question}</span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {q.skill && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-xs border border-purple-500/20">
                              {q.skill}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${DIFFICULTY_COLOR[q.difficulty] || ""}`}>
                            {q.difficulty}
                          </span>
                          {expanded === q.id
                            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {expanded === q.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                            <div className="px-14 pb-4 text-sm text-muted-foreground leading-relaxed bg-secondary/10">
                              <div className="flex flex-wrap gap-2 mt-1">
                                <span className="text-xs px-2 py-1 rounded-lg bg-secondary border border-border">
                                  Category: <strong>{q.category}</strong>
                                </span>
                                {q.skill && (
                                  <span className="text-xs px-2 py-1 rounded-lg bg-secondary border border-border">
                                    Skill: <strong>{q.skill}</strong>
                                  </span>
                                )}
                                <span className="text-xs px-2 py-1 rounded-lg bg-secondary border border-border">
                                  Difficulty: <strong>{q.difficulty}</strong>
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
