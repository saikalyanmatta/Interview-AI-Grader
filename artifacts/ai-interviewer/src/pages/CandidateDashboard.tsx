import React, { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Mic, Trash2, ChevronRight, Clock, CheckCircle, Circle, BarChart3, Award, Medal } from "lucide-react";
import { toast } from "sonner";
import { BadgesPanel } from "@/components/BadgesPanel";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }) };

function recommendationBadge(rec: string | null) {
  if (rec === "hire") return <span className="badge-hire px-2.5 py-1 rounded-full text-xs font-semibold">Hire</span>;
  if (rec === "maybe") return <span className="badge-maybe px-2.5 py-1 rounded-full text-xs font-semibold">Maybe</span>;
  if (rec === "no_hire") return <span className="badge-no-hire px-2.5 py-1 rounded-full text-xs font-semibold">No Hire</span>;
  return null;
}

export default function CandidateDashboard() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"interviews" | "badges">("interviews");
  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ["interviews"],
    queryFn: async () => {
      const r = await fetch("/api/interviews");
      if (!r.ok) throw new Error("Failed to load");
      return r.json();
    },
  });

  const deleteIv = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/interviews/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["interviews"] }); toast.success("Interview deleted"); },
    onError: () => toast.error("Could not delete interview"),
  });

  const completed = interviews.filter((i: any) => i.status === "completed");
  const bestScore = completed.length ? Math.max(...completed.map((i: any) => i.overallScore ?? 0)) : null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0} className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold mb-1">My Interviews</h1>
          <p className="text-muted-foreground">Track your practice sessions and progress</p>
        </div>
        <Link href="/setup">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold btn-gradient text-sm">
            <Plus className="h-4 w-4" />
            New Interview
          </button>
        </Link>
      </motion.div>

      {!isLoading && interviews.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Sessions", value: interviews.length, icon: Mic, color: "from-indigo-500 to-blue-600" },
            { label: "Completed", value: completed.length, icon: CheckCircle, color: "from-emerald-500 to-teal-600" },
            { label: "Best Score", value: bestScore !== null ? `${bestScore}/100` : "—", icon: Award, color: "from-purple-500 to-pink-600" },
          ].map((stat, i) => (
            <motion.div key={i} initial="hidden" animate="show" variants={fadeUp} custom={i + 1} className="glass-panel rounded-2xl p-5 flex items-center gap-4">
              <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-display font-bold text-2xl">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && interviews.length > 0 && (
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={4} className="flex gap-1 p-1 rounded-xl bg-secondary/50 border border-border w-fit mb-6">
          {(["interviews", "badges"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t ? "bg-background border border-border shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "interviews" ? <><BarChart3 className="h-3.5 w-3.5" />My Interviews</> : <><Medal className="h-3.5 w-3.5" />Badges</>}
            </button>
          ))}
        </motion.div>
      )}

      {!isLoading && activeTab === "badges" && (
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={5} className="glass-panel rounded-2xl p-6">
          <BadgesPanel interviews={interviews} />
        </motion.div>
      )}

      {(isLoading || activeTab === "interviews") && isLoading ? (
        <div className="grid gap-4">{[1, 2, 3].map(i => <div key={i} className="glass-panel rounded-2xl p-5 h-24 animate-pulse bg-secondary/30" />)}</div>
      ) : activeTab === "interviews" && interviews.length === 0 ? (
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1} className="glass-panel rounded-3xl p-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Mic className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-display font-bold mb-2">No interviews yet</h3>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">Start your first AI-powered mock interview to practice and get instant detailed feedback.</p>
          <Link href="/setup">
            <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold btn-gradient text-sm">
              <Plus className="h-4 w-4" />Start Your First Interview
            </button>
          </Link>
        </motion.div>
      ) : activeTab === "interviews" ? (
        <div className="grid gap-3">
          {interviews.map((iv: any, i: number) => (
            <motion.div key={iv.id} initial="hidden" animate="show" variants={fadeUp} custom={i + 2} className="glass-panel rounded-2xl p-5 flex items-center gap-4">
              <div className="flex-shrink-0">
                {iv.status === "completed" ? <CheckCircle className="h-5 w-5 text-emerald-500" /> :
                  iv.status === "in_progress" ? <Clock className="h-5 w-5 text-amber-500" /> :
                    <Circle className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{iv.role || "Interview"}</span>
                  {iv.jobTitle && <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">{iv.jobTitle}</span>}
                  {recommendationBadge(iv.recommendation)}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{iv.difficulty} • {iv.interviewStyle}</span>
                  <span>{new Date(iv.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              {iv.overallScore !== null && (
                <div className="text-right flex-shrink-0">
                  <div className={`font-display font-bold text-xl ${iv.overallScore >= 75 ? "text-emerald-500" : iv.overallScore >= 50 ? "text-amber-500" : "text-red-500"}`}>{iv.overallScore}</div>
                  <div className="text-xs text-muted-foreground">/ 100</div>
                </div>
              )}
              <div className="flex items-center gap-1 flex-shrink-0">
                {iv.status === "completed" ? (
                  <Link href={`/interview/${iv.id}/report`}>
                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      <BarChart3 className="h-3.5 w-3.5" />Report
                    </button>
                  </Link>
                ) : iv.status === "in_progress" ? (
                  <Link href={`/interview/${iv.id}`}>
                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium btn-gradient">
                      Continue <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                ) : null}
                <button onClick={() => { if (confirm("Delete this interview?")) deleteIv.mutate(iv.id); }} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
