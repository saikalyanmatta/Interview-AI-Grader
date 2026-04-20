import React, { useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Calendar, ChevronLeft, Loader2, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }) };

export default function EditScheduledInterview() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);

  const { data: si, isLoading } = useQuery({
    queryKey: ["scheduled-interview", id],
    queryFn: async () => {
      const r = await fetch(`/api/scheduled-interviews/${id}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: !!id,
  });

  const [form, setForm] = useState<{ title: string; startTime: string; deadlineTime: string } | null>(null);

  React.useEffect(() => {
    if (si && !form) {
      const toLocalInput = (iso: string) => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      setForm({
        title: si.title || "",
        startTime: si.startTime ? toLocalInput(si.startTime) : "",
        deadlineTime: si.deadlineTime ? toLocalInput(si.deadlineTime) : "",
      });
    }
  }, [si, form]);

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => prev ? { ...prev, [key]: e.target.value } : null);

  const handleSave = async () => {
    if (!form || !form.title || !form.startTime || !form.deadlineTime) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/scheduled-interviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          startTime: form.startTime,
          deadlineTime: form.deadlineTime,
        }),
      });
      if (!r.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ["scheduled-interviews"] });
      toast.success("Interview updated");
      setLocation("/employer");
    } catch {
      toast.error("Failed to update interview");
      setSaving(false);
    }
  };

  const handleAbort = async () => {
    setAborting(true);
    try {
      const r = await fetch(`/api/scheduled-interviews/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      qc.invalidateQueries({ queryKey: ["scheduled-interviews"] });
      toast.success("Interview session cancelled");
      setLocation("/employer");
    } catch {
      toast.error("Failed to cancel interview");
      setAborting(false);
    }
  };

  if (isLoading || !form) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const now = new Date();
  const start = new Date(si.startTime);
  const deadline = new Date(si.deadlineTime);
  const status = now < start ? "upcoming" : now > deadline ? "ended" : "live";

  return (
    <div className="container mx-auto px-4 py-10 max-w-xl">
      <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0} className="mb-8">
        <Link href="/employer">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ChevronLeft className="h-4 w-4" />Back to Portal
          </button>
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-display font-bold">Edit Interview</h1>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status === "live" ? "bg-emerald-500/10 text-emerald-500" : status === "upcoming" ? "bg-amber-500/10 text-amber-500" : "bg-secondary text-muted-foreground"}`}>
            {status === "live" ? "Live" : status === "upcoming" ? "Upcoming" : "Ended"}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">Adjust the schedule timings or cancel this session</p>
      </motion.div>

      <div className="grid gap-5">
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={1} className="glass-panel rounded-2xl p-6 grid gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5" /> Session Details
          </h2>

          <div>
            <label className="block text-sm font-medium mb-2">Interview Title</label>
            <input value={form.title} onChange={f("title")} placeholder="Session title"
              className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Time</label>
              <input type="datetime-local" value={form.startTime} onChange={f("startTime")}
                className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Deadline</label>
              <input type="datetime-local" value={form.deadlineTime} onChange={f("deadlineTime")}
                className="w-full rounded-xl bg-secondary/50 border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-secondary/40 rounded-xl px-4 py-3">
            <span className="font-medium text-foreground">Read-only config:</span> {si.interviewType} interview · {si.difficulty} · {si.interviewStyle} style · {si.codingQuestionsCount} coding question{si.codingQuestionsCount !== 1 ? "s" : ""}
            {si.codingQuestionsCount > 0 && ` · ${si.codingLanguage}`}
          </div>
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={2}>
          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold btn-gradient disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <><Loader2 className="h-5 w-5 animate-spin" />Saving...</> : <><Calendar className="h-5 w-5" />Save Changes</>}
          </button>
        </motion.div>

        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={3} className="glass-panel rounded-2xl p-5 border border-destructive/20">
          <h2 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4" /> Danger Zone
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Cancelling this interview will permanently delete the session and remove all invited candidates. Completed interview data is preserved.
          </p>
          {!showAbortConfirm ? (
            <button onClick={() => setShowAbortConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />Cancel / Abort Interview
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground flex-1">Are you sure? This cannot be undone.</span>
              <button onClick={() => setShowAbortConfirm(false)} className="px-4 py-2 rounded-xl text-sm border border-border bg-secondary hover:bg-secondary/80 transition-colors">
                Never mind
              </button>
              <button onClick={handleAbort} disabled={aborting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-destructive text-white hover:bg-destructive/90 disabled:opacity-60 transition-colors"
              >
                {aborting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Yes, Cancel
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
