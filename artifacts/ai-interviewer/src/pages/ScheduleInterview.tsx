import { useState } from "react";
import { useLocation } from "wouter";
import { useListJobs } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Code, ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function createScheduledInterview(data: any) {
  const r = await fetch(`${BASE}/api/scheduled-interviews`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error((e as any).error || "Failed to create");
  }
  return r.json();
}

export default function ScheduleInterview() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: jobs } = useListJobs();
  const [isLoading, setIsLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [codingQuestionsCount, setCodingQuestionsCount] = useState(0);
  const [role, setRole] = useState("Software Engineer");
  const [difficulty, setDifficulty] = useState("Medium");
  const [interviewStyle, setInterviewStyle] = useState("Friendly");

  const handleSubmit = async () => {
    if (!title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    if (!startDate || !startTime) { toast({ title: "Start time required", variant: "destructive" }); return; }
    if (!deadlineDate || !deadlineTime) { toast({ title: "Deadline required", variant: "destructive" }); return; }
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const deadlineDateTime = new Date(`${deadlineDate}T${deadlineTime}`);
    if (deadlineDateTime <= startDateTime) {
      toast({ title: "Deadline must be after start time", variant: "destructive" }); return;
    }
    setIsLoading(true);
    try {
      const si = await createScheduledInterview({
        title,
        jobId: selectedJobId,
        startTime: startDateTime.toISOString(),
        deadlineTime: deadlineDateTime.toISOString(),
        codingQuestionsCount,
        role,
        difficulty,
        interviewStyle,
      });
      toast({ title: "Interview scheduled!", description: "Add candidates to your scheduled interview." });
      setLocation(`/employer/scheduled/${si.id}/candidates`);
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const selClass = (active: boolean) => cn(
    "p-3 rounded-xl border text-sm font-medium transition-all cursor-pointer",
    active ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/30"
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/employer")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold">Schedule Interview</h1>
          <p className="text-muted-foreground text-sm">Create an interview session and invite candidates by email.</p>
        </div>
      </div>

      <Card className="glass-panel border-white/10">
        <CardContent className="p-6 space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Interview Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer — Q2 2025"
              className="bg-black/20 border-white/10"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Job Profile <span className="text-muted-foreground font-normal">(optional)</span></label>
            <p className="text-xs text-muted-foreground mb-3">Link to a job profile for skill-specific grading.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => setSelectedJobId(null)} className={selClass(selectedJobId === null)}>
                <div className="flex justify-between items-center">
                  <span>No specific profile</span>
                  {selectedJobId === null && <Check className="h-4 w-4" />}
                </div>
              </button>
              {jobs?.map((job) => (
                <button key={job.id} onClick={() => setSelectedJobId(job.id)} className={selClass(selectedJobId === job.id)}>
                  <div className="flex justify-between items-center">
                    <div className="text-left">
                      <p className="font-medium">{job.title}</p>
                      <p className="text-xs opacity-60">{job.skills.length} skills</p>
                    </div>
                    {selectedJobId === job.id && <Check className="h-4 w-4" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Start Date *
              </label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-black/20 border-white/10" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Start Time *
              </label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-black/20 border-white/10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Calendar className="h-4 w-4 text-red-400" /> Deadline Date *
              </label>
              <Input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} className="bg-black/20 border-white/10" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <Clock className="h-4 w-4 text-red-400" /> Deadline Time *
              </label>
              <Input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} className="bg-black/20 border-white/10" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {["Software Engineer", "Product Manager", "HR Interview"].map((r) => (
                <button key={r} onClick={() => setRole(r)} className={selClass(role === r)}>{r}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {["Easy", "Medium", "Hard"].map((d) => (
                <button key={d} onClick={() => setDifficulty(d)} className={selClass(difficulty === d)}>{d}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Interview Style</label>
            <div className="grid grid-cols-3 gap-2">
              {["Friendly", "Strict", "Technical Deep Dive"].map((s) => (
                <button key={s} onClick={() => setInterviewStyle(s)} className={selClass(interviewStyle === s)}>{s}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Code className="h-4 w-4 text-primary" /> Coding Questions
            </label>
            <p className="text-xs text-muted-foreground mb-3">Number of coding questions at the end of the interview (0–2).</p>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((n) => (
                <button key={n} onClick={() => setCodingQuestionsCount(n)} className={selClass(codingQuestionsCount === n)}>
                  {n === 0 ? "None" : `${n} Question${n > 1 ? "s" : ""}`}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <Button variant="gradient" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? "Scheduling..." : "Schedule & Add Candidates →"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
