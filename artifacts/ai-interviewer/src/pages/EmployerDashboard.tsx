import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListJobs, useDeleteJob } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Briefcase, Trash2, Users, Calendar, Clock, ArrowRight, BarChart2, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchScheduledInterviews() {
  const r = await fetch(`${BASE}/api/scheduled-interviews`, { credentials: "include" });
  if (!r.ok) return [];
  return r.json();
}

async function deleteScheduledInterview(id: number) {
  const r = await fetch(`${BASE}/api/scheduled-interviews/${id}`, { method: "DELETE", credentials: "include" });
  if (!r.ok) throw new Error("Failed to delete");
}

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function getStatus(si: any) {
  const now = new Date();
  const start = new Date(si.startTime);
  const end = new Date(si.deadlineTime);
  if (now < start) return { label: "Upcoming", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" };
  if (now > end) return { label: "Expired", color: "text-red-400 bg-red-400/10 border-red-400/20" };
  return { label: "Active", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" };
}

export default function EmployerDashboard() {
  const [activeTab, setActiveTab] = useState<"scheduled" | "jobs">("scheduled");
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useListJobs();
  const deleteJobMutation = useDeleteJob();
  const { toast } = useToast();
  const [scheduledInterviews, setScheduledInterviews] = useState<any[]>([]);
  const [siLoading, setSiLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetchScheduledInterviews().then((data) => {
      setScheduledInterviews(data);
      setSiLoading(false);
    });
  }, []);

  const handleDeleteJob = async (id: number) => {
    if (confirm("Are you sure you want to delete this job profile?")) {
      try {
        await deleteJobMutation.mutateAsync({ id });
        toast({ title: "Job deleted" });
        refetchJobs();
      } catch (err: any) {
        toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
      }
    }
  };

  const handleDeleteSI = async (id: number) => {
    if (confirm("Delete this scheduled interview and all its data?")) {
      try {
        await deleteScheduledInterview(id);
        setScheduledInterviews(prev => prev.filter(s => s.id !== id));
        toast({ title: "Deleted" });
      } catch (e: any) {
        toast({ title: "Failed", description: e.message, variant: "destructive" });
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Employer Portal</h1>
          <p className="text-muted-foreground mt-1">Manage job profiles and schedule interviews for candidates.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/employer/jobs/new">
            <Button variant="outline" className="gap-2 border-white/20 bg-black/20">
              <Briefcase className="h-4 w-4" /> New Job Profile
            </Button>
          </Link>
          <Link href="/employer/schedule">
            <Button variant="gradient" className="gap-2">
              <Plus className="h-4 w-4" /> Schedule Interview
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
        <button
          onClick={() => setActiveTab("scheduled")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === "scheduled" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}
        >
          <Calendar className="h-4 w-4" /> Scheduled Interviews
        </button>
        <button
          onClick={() => setActiveTab("jobs")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === "jobs" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}
        >
          <Briefcase className="h-4 w-4" /> Job Profiles
        </button>
      </div>

      {activeTab === "scheduled" && (
        <>
          {siLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map(i => <div key={i} className="h-64 rounded-2xl bg-white/5 animate-pulse border border-white/10" />)}
            </div>
          ) : scheduledInterviews.length === 0 ? (
            <div className="glass-panel rounded-2xl p-16 text-center flex flex-col items-center border-dashed border-2 border-white/20">
              <div className="h-16 w-16 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6">
                <Calendar className="h-8 w-8 text-indigo-400" />
              </div>
              <h3 className="text-xl font-display font-semibold mb-2">No Scheduled Interviews</h3>
              <p className="text-muted-foreground mb-6 max-w-md">Schedule an interview to invite candidates. Set start/deadline times and manage who can participate.</p>
              <Link href="/employer/schedule">
                <Button variant="outline" className="border-white/20 bg-black/20">Schedule First Interview</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {scheduledInterviews.map((si, index) => {
                const status = getStatus(si);
                const interviewLink = `${window.location.origin}${BASE}/interview-access/${si.id}`;
                return (
                  <motion.div key={si.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                    <Card className="h-full flex flex-col glass-panel hover:-translate-y-1 transition-transform duration-300">
                      <CardContent className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-display font-semibold text-lg leading-tight truncate">{si.title}</h3>
                            {si.jobTitle && <p className="text-xs text-primary mt-0.5">{si.jobTitle}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Badge className={`text-xs border ${status.color}`}>{status.label}</Badge>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDeleteSI(si.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1.5 mb-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            <span>Start: {formatDateTime(si.startTime)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-red-400" />
                            <span>Deadline: {formatDateTime(si.deadlineTime)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                          <div className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            <span>{si.candidateCount} candidates</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <BarChart2 className="h-3.5 w-3.5" />
                            <span>{si.attemptCount} attempted</span>
                          </div>
                        </div>

                        <div className="bg-black/30 rounded-lg p-2 mb-4 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{interviewLink.replace("https://", "")}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs shrink-0 text-primary hover:text-primary"
                            onClick={() => {
                              navigator.clipboard.writeText(interviewLink);
                              toast({ title: "Link copied!" });
                            }}
                          >
                            Copy
                          </Button>
                        </div>

                        <div className="pt-3 border-t border-white/10 flex gap-2 mt-auto">
                          <Link href={`/employer/scheduled/${si.id}/candidates`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full border-white/10 text-xs gap-1">
                              <Users className="h-3 w-3" /> Candidates
                            </Button>
                          </Link>
                          {new Date() >= new Date(si.startTime) && (
                            <Link href={`/employer/scheduled/${si.id}/results`} className="flex-1">
                              <Button variant="outline" size="sm" className="w-full border-primary/30 text-primary text-xs gap-1">
                                <BarChart2 className="h-3 w-3" /> Results
                              </Button>
                            </Link>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "jobs" && (
        <>
          {jobsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map(i => <div key={i} className="h-64 rounded-2xl bg-white/5 animate-pulse border border-white/10" />)}
            </div>
          ) : jobs?.length === 0 ? (
            <div className="glass-panel rounded-2xl p-16 text-center flex flex-col items-center border-dashed border-2 border-white/20">
              <div className="h-16 w-16 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-6">
                <Briefcase className="h-8 w-8 text-indigo-400" />
              </div>
              <h3 className="text-xl font-display font-semibold mb-2">No Job Profiles</h3>
              <p className="text-muted-foreground mb-6 max-w-md">Create job profiles with required skills. Then schedule interviews and link them to a profile for skill-based grading.</p>
              <Link href="/employer/jobs/new">
                <Button variant="outline" className="border-white/20 bg-black/20">Create First Profile</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {jobs?.map((job, index) => (
                <motion.div key={job.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                  <Card className="h-full flex flex-col glass-panel hover:-translate-y-1 transition-transform duration-300">
                    <CardContent className="p-6 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-display font-semibold text-xl leading-tight">{job.title}</h3>
                          <p className="text-xs text-primary mt-1">{(job as any).role ?? "Software Engineer"}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 -mt-2 -mr-2" onClick={() => handleDeleteJob(job.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1">{job.description}</p>
                      <div className="space-y-3 mb-6">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Required Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {job.skills.map((skill, i) => (
                            <Badge key={i} variant="secondary" className="bg-white/5 border-white/10 text-xs">
                              {skill.name} <span className="opacity-50 ml-1">L{skill.requiredLevel} · {(skill as any).weight ?? 50}%</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="pt-4 border-t border-white/10 flex justify-end mt-auto">
                        <Link href="/employer/schedule">
                          <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 gap-1">
                            Schedule Interview <ChevronRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
