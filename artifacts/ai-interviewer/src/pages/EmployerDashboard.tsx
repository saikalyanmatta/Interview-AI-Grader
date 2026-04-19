import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Briefcase, Calendar, Trash2, Users, ChevronRight, BarChart3, Clock } from "lucide-react";
import { toast } from "sonner";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }) };

export default function EmployerDashboard() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"jobs" | "scheduled">("scheduled");
  const qc = useQueryClient();

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => { const r = await fetch("/api/jobs"); if (!r.ok) throw new Error(); return r.json(); },
  });
  const { data: scheduled = [], isLoading: siLoading } = useQuery({
    queryKey: ["scheduled-interviews"],
    queryFn: async () => { const r = await fetch("/api/scheduled-interviews"); if (!r.ok) throw new Error(); return r.json(); },
  });

  const deleteJob = useMutation({
    mutationFn: async (id: number) => { const r = await fetch(`/api/jobs/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); toast.success("Job deleted"); },
  });
  const deleteSi = useMutation({
    mutationFn: async (id: number) => { const r = await fetch(`/api/scheduled-interviews/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scheduled-interviews"] }); toast.success("Interview deleted"); },
  });

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0} className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold mb-1">Employer Portal</h1>
          <p className="text-muted-foreground">Manage job profiles and interview sessions</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/employer/jobs/new">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-border bg-secondary/60 hover:bg-secondary transition-colors">
              <Plus className="h-4 w-4" />New Job
            </button>
          </Link>
          <Link href="/employer/schedule">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold btn-gradient text-sm">
              <Calendar className="h-4 w-4" />Schedule Interview
            </button>
          </Link>
        </div>
      </motion.div>

      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1} className="flex gap-1 p-1 rounded-xl bg-secondary/50 border border-border w-fit mb-8">
        {(["scheduled", "jobs"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-background border border-border shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "scheduled" ? "Scheduled Interviews" : "Job Profiles"}
          </button>
        ))}
      </motion.div>

      {tab === "scheduled" && (
        <div>
          {siLoading ? (
            <div className="grid gap-4">{[1, 2].map(i => <div key={i} className="glass-panel rounded-2xl h-28 animate-pulse bg-secondary/30" />)}</div>
          ) : scheduled.length === 0 ? (
            <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2} className="glass-panel rounded-3xl p-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Calendar className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-display font-bold mb-2">No scheduled interviews</h3>
              <p className="text-muted-foreground mb-6 text-sm">Schedule batch interviews and invite candidates by email.</p>
              <Link href="/employer/schedule">
                <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold btn-gradient text-sm">
                  <Plus className="h-4 w-4" />Schedule Now
                </button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid gap-3">
              {scheduled.map((si: any, i: number) => {
                const now = new Date();
                const start = new Date(si.startTime);
                const deadline = new Date(si.deadlineTime);
                const status = now < start ? "upcoming" : now > deadline ? "ended" : "live";
                return (
                  <motion.div key={si.id} initial="hidden" animate="show" variants={fadeUp} custom={i + 2} className="glass-panel rounded-2xl p-5 flex items-center gap-4">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${status === "live" ? "bg-emerald-500/10" : status === "upcoming" ? "bg-amber-500/10" : "bg-secondary"}`}>
                      <Calendar className={`h-5 w-5 ${status === "live" ? "text-emerald-500" : status === "upcoming" ? "text-amber-500" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold truncate">{si.title}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status === "live" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : status === "upcoming" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-secondary text-muted-foreground"}`}>
                          {status === "live" ? "Live" : status === "upcoming" ? "Upcoming" : "Ended"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{si.role} • {si.candidateCount || 0} candidates • {si.attemptCount || 0} attempts</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {start.toLocaleDateString()} → {deadline.toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Link href={`/employer/scheduled/${si.id}/candidates`}>
                        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                          <Users className="h-3.5 w-3.5" />Candidates
                        </button>
                      </Link>
                      <Link href={`/employer/scheduled/${si.id}/results`}>
                        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors">
                          <BarChart3 className="h-3.5 w-3.5" />Results
                        </button>
                      </Link>
                      <button onClick={() => { if (confirm("Delete?")) deleteSi.mutate(si.id); }} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "jobs" && (
        <div>
          {jobsLoading ? (
            <div className="grid gap-4">{[1, 2].map(i => <div key={i} className="glass-panel rounded-2xl h-28 animate-pulse bg-secondary/30" />)}</div>
          ) : jobs.length === 0 ? (
            <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2} className="glass-panel rounded-3xl p-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Briefcase className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-display font-bold mb-2">No job profiles yet</h3>
              <p className="text-muted-foreground mb-6 text-sm">Create job profiles to define required skills and use them in scheduled interviews.</p>
              <Link href="/employer/jobs/new">
                <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold btn-gradient text-sm">
                  <Plus className="h-4 w-4" />Create Job Profile
                </button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid gap-3">
              {jobs.map((job: any, i: number) => (
                <motion.div key={job.id} initial="hidden" animate="show" variants={fadeUp} custom={i + 2} className="glass-panel rounded-2xl p-5 flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate mb-0.5">{job.title}</div>
                    <div className="text-sm text-muted-foreground">{job.role} • {(job.skills || []).length} skills</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { if (confirm("Delete job?")) deleteJob.mutate(job.id); }} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
